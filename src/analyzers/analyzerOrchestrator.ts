import * as vscode from 'vscode';
import { ConfigurationService } from '../services/configurationService';
import { Diagnostics, StatusBar, Notifications } from '../infra';
import { CacheService } from '../services/cacheService';
import { FileSystemUtils } from '../shared/utils/fileSystemUtils';
import { AnalyzerConfig, Logger, MethodInfo } from '../shared/types';
import { AnalysisQueue } from './analysisQueue';
import { AnalysisExecutor } from './analysisExecutor';
import { AnalysisComposer } from './analysisComposer';
import { FileAnalysisHandler } from './fileAnalysisHandler';

export interface AnalyzerOrchestratorOptions {
    processingIntervalMs?: number;
    fileEventBatchWindowMs?: number;
}

/**
 * Main orchestrator for Dart unused code analysis.
 * Coordinates between workspace analysis, incremental updates, and lifecycle events.
 * Uses AnalysisQueue and AnalysisExecutor for task management and execution.
 */
export class AnalyzerOrchestrator {
    private unusedReanalysisTimer?: NodeJS.Timeout;
    private currentReanalysisIntervalMs?: number;
    private readonly configChangeDisposable: vscode.Disposable;
    private queueProcessingInterval?: NodeJS.Timeout;
    private readonly processingIntervalMs: number;
    private readonly fileEventBatchWindowMs: number;
    private fileEventBatchTimer?: NodeJS.Timeout;
    private pendingFileEvents: Array<{ type: 'create' | 'update' | 'delete'; filePath: string }> = [];

    constructor(
        private readonly analysisQueue: AnalysisQueue,
        private readonly analysisExecutor: AnalysisExecutor,
        private readonly fileAnalysisHandler: FileAnalysisHandler,
        private readonly configService: ConfigurationService,
        private readonly diagnostics: Diagnostics,
        private readonly cache: CacheService,
        private readonly logger: Logger,
        options: AnalyzerOrchestratorOptions = {}
    ) {
        this.processingIntervalMs = options.processingIntervalMs ?? 500;
        this.fileEventBatchWindowMs = options.fileEventBatchWindowMs ?? 300; // 300ms batch window
        this.refreshReanalysisSchedule();
        this.startQueueProcessing();
        this.configChangeDisposable = this.configService.onDidChangeConfiguration((config) => {
            this.logger.debug('Configuration changed, updating orchestrator state');
            this.handleConfigurationChange(config);
        });
    }

    /**
     * Starts periodic queue processing.
     */
    private startQueueProcessing(): void {
        this.queueProcessingInterval = setInterval(() => {
            void this.processQueue();
        }, this.processingIntervalMs);
    }

    /**
     * Processes the analysis queue.
     */
    private async processQueue(): Promise<void> {
        // Skip if already processing or queue is empty
        if (this.analysisQueue.isProcessing() || this.analysisQueue.isEmpty()) {
            return;
        }

        const config = this.configService.getConfiguration();
        if (!config.enabled) {
            return;
        }

        this.analysisQueue.setProcessing(true);

        try {
            const task = this.analysisQueue.dequeue();
            if (!task) {
                return;
            }

            this.logger.debug(`Processing task ${task.id} from queue`);
            StatusBar.showProgress('Analyzing...');

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                this.logger.warn('No workspace folder found for analysis');
                return;
            }

            const workspacePath = workspaceFolder.uri.fsPath;

            try {
                await this.analysisExecutor.executeTask(task, workspacePath, config);
                this.logger.debug(`Task ${task.id} completed successfully`);
            } catch (error) {
                this.logger.error(`Task ${task.id} failed: ${this.formatError(error)}`);
                Notifications.showError(`Analysis error: ${this.formatError(error)}`);
            }
        } finally {
            this.analysisQueue.setProcessing(false);
            StatusBar.hide();
        }
    }

    /**
     * Refreshes the periodic reanalysis schedule based on configuration.
     */
    private refreshReanalysisSchedule(config?: AnalyzerConfig): void {
        const resolvedConfig = config ?? this.configService.getConfiguration();
        if (!resolvedConfig.enabled) {
            this.clearReanalysisSchedule();
            return;
        }

        const minutes = resolvedConfig.unusedCodeReanalysisIntervalMinutes;

        if (!minutes || minutes <= 0) {
            this.clearReanalysisSchedule();
            return;
        }

        const intervalMs = minutes * 60_000;
        if (this.unusedReanalysisTimer && this.currentReanalysisIntervalMs === intervalMs) {
            return;
        }

        this.clearReanalysisSchedule();
        this.currentReanalysisIntervalMs = intervalMs;
        this.unusedReanalysisTimer = setInterval(() => {
            void this.enqueueUnusedMethodReanalysis();
        }, intervalMs);
    }

    /**
     * Clears the periodic reanalysis schedule.
     */
    private clearReanalysisSchedule(): void {
        if (this.unusedReanalysisTimer) {
            clearInterval(this.unusedReanalysisTimer);
            this.unusedReanalysisTimer = undefined;
        }
        this.currentReanalysisIntervalMs = undefined;
    }

    /**
     * Handles configuration changes.
     */
    private handleConfigurationChange(config: AnalyzerConfig): void {
        this.refreshReanalysisSchedule(config);

        if (!config.enabled) {
            this.logger.info('Analyzer disabled via configuration change');
            this.diagnostics.clear();
            this.analysisQueue.clear();
            StatusBar.hide();
        }
    }

    /**
     * Enqueues a reanalysis of all cached unused methods.
     */
    private async enqueueUnusedMethodReanalysis(): Promise<void> {
        const config = this.configService.getConfiguration();
        if (!config.enabled) {
            return;
        }

        this.refreshReanalysisSchedule(config);

        if (!config.unusedCodeReanalysisIntervalMinutes || config.unusedCodeReanalysisIntervalMinutes <= 0) {
            this.clearReanalysisSchedule();
            return;
        }

        const cachedMethods = this.cache.getAll();
        if (cachedMethods.length === 0) {
            return;
        }

        // Compose a reference recheck task (no extraction, just checking)
        const task = AnalysisComposer.composeReferenceRecheckAnalysis();
        this.analysisQueue.enqueue(task);
        this.logger.info(`Queued periodic reanalysis of ${cachedMethods.length} cached methods`);
    }

    /**
     * Groups methods by file path.
     */
    private groupMethodsByFile(methods: MethodInfo[]): Map<string, MethodInfo[]> {
        const grouped = new Map<string, MethodInfo[]>();

        for (const method of methods) {
            if (!grouped.has(method.filePath)) {
                grouped.set(method.filePath, []);
            }

            grouped.get(method.filePath)!.push(method);
        }

        return grouped;
    }

    /**
     * Formats an error for logging.
     */
    private formatError(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    }

    /**
     * Analyzes the entire workspace for unused methods.
     */
    async analyzeWorkspace(): Promise<void> {
        const config = this.configService.getConfiguration();
        if (!config.enabled) {
            Notifications.showInfo('Dart Unused Code: disabled');
            return;
        }

        this.refreshReanalysisSchedule(config);

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            this.diagnostics.clear();
            Notifications.showWarning('No workspace folder open');
            return;
        }

        // Clear previous diagnostics
        this.diagnostics.clear();

        // Compose and enqueue workspace analysis task
        const task = AnalysisComposer.composeWorkspaceAnalysis();
        this.analysisQueue.enqueue(task);

        this.logger.info(`Workspace analysis queued`);
    }

    /**
     * Analyzes a single file incrementally when it's changed.
     */
    async analyzeFile(document: vscode.TextDocument): Promise<void> {
        const config = this.configService.getConfiguration();
        if (!config.enabled) {
            return;
        }
        if (!config.incrementalAnalysis) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const shouldExclude = FileSystemUtils.shouldExclude(
            document.uri.fsPath,
            workspaceFolder.uri.fsPath,
            config.excludePatterns || []
        );

        if (shouldExclude) {
            this.logger.debug(`Skipping excluded file: ${document.uri.fsPath}`);
            return;
        }

        this.refreshReanalysisSchedule(config);

        // Use file analysis handler to enqueue update
        await this.fileAnalysisHandler.handleFileUpdate(
            document.uri.fsPath,
            config.excludePatterns,
            workspaceFolder.uri.fsPath,
            config
        );
    }

    /**
     * Handles the creation of a new file.
     */
    async handleFileCreated(createdFilePath: string): Promise<void> {
        const config = this.configService.getConfiguration();
        this.refreshReanalysisSchedule(config);

        if (!config.enabled) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        // Batch file events to handle bulk operations (like branch switches)
        this.batchFileEvent('create', createdFilePath);
    }

    /**
     * Handles file changes (saves).
     */
    async handleFileChanged(changedFilePath: string): Promise<void> {
        const config = this.configService.getConfiguration();
        this.refreshReanalysisSchedule(config);

        if (!config.enabled || !config.incrementalAnalysis) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        // Batch file change events to prevent excessive analysis on frequent saves
        this.batchFileEvent('update', changedFilePath);
    }

    /**
     * Handles the deletion of a file.
     */
    async handleFileDeleted(deletedFilePath: string): Promise<void> {
        const config = this.configService.getConfiguration();
        this.refreshReanalysisSchedule(config);

        if (!config.enabled) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        // Batch file events to handle bulk operations
        this.batchFileEvent('delete', deletedFilePath);
    }

    /**
     * Batches file events to optimize bulk operations.
     * If many files change rapidly, we'll process them together.
     * Deduplicates events for the same file (keeps latest event type).
     */
    private batchFileEvent(type: 'create' | 'update' | 'delete', filePath: string): void {
        // Remove any existing events for this file (keep only the latest)
        this.pendingFileEvents = this.pendingFileEvents.filter(e => e.filePath !== filePath);

        // Add the new event
        this.pendingFileEvents.push({ type, filePath });

        // Clear existing timer
        if (this.fileEventBatchTimer) {
            clearTimeout(this.fileEventBatchTimer);
        }

        // Set new timer to process batch
        this.fileEventBatchTimer = setTimeout(() => {
            void this.processBatchedFileEvents();
        }, this.fileEventBatchWindowMs);
    }

    /**
     * Processes batched file events.
     * If many files are affected, converts to workspace analysis.
     */
    private async processBatchedFileEvents(): Promise<void> {
        const events = this.pendingFileEvents;
        this.pendingFileEvents = [];
        this.fileEventBatchTimer = undefined;

        if (events.length === 0) {
            return;
        }

        const config = this.configService.getConfiguration();
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const workspacePath = workspaceFolder.uri.fsPath;

        // If many files (e.g., >10), do a workspace analysis instead
        if (events.length > 10) {
            this.logger.info(
                `Large batch of ${events.length} file events detected - switching to workspace analysis`
            );
            const task = AnalysisComposer.composeWorkspaceAnalysis();
            this.analysisQueue.enqueue(task);
            return;
        }

        // Process individual file events
        this.logger.debug(`Processing batch of ${events.length} file events`);
        for (const event of events) {
            switch (event.type) {
                case 'create':
                    await this.fileAnalysisHandler.handleFileCreation(
                        event.filePath,
                        config.excludePatterns,
                        workspacePath,
                        config
                    );
                    break;
                case 'update':
                    await this.fileAnalysisHandler.handleFileUpdate(
                        event.filePath,
                        config.excludePatterns,
                        workspacePath,
                        config
                    );
                    break;
                case 'delete':
                    await this.fileAnalysisHandler.handleFileDeletion(
                        event.filePath,
                        config.excludePatterns,
                        workspacePath,
                        config
                    );
                    break;
            }
        }
    }

    /**
     * Disposes resources.
     */
    dispose(): void {
        this.clearReanalysisSchedule();
        if (this.queueProcessingInterval) {
            clearInterval(this.queueProcessingInterval);
        }
        if (this.fileEventBatchTimer) {
            clearTimeout(this.fileEventBatchTimer);
        }
        this.configChangeDisposable.dispose();
        StatusBar.dispose();
    }
}
