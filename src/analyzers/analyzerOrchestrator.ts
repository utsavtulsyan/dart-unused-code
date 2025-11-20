import * as vscode from 'vscode';
import { ConfigurationService } from '../services/configurationService';
import { Diagnostics, StatusBar, Notifications } from '../infra';
import { WorkspaceAnalyzer } from '../core/workspaceAnalyzer';
import { IncrementalAnalysisHandler } from '../handlers/incrementalAnalysisHandler';
import { CacheService } from '../services/cacheService';
import { FileSystemUtils } from '../shared/utils/fileSystemUtils';
import { AnalyzerConfig, Logger, MethodInfo } from '../shared/types';

enum AnalyzerTaskType {
    Workspace = 'workspace',
    File = 'file',
    Create = 'create',
    Delete = 'delete',
    Reanalysis = 'reanalysis'
}

interface AnalyzerTaskRequest {
    type: AnalyzerTaskType;
    resource?: string;
    run: () => Promise<void>;
    maxRetries?: number;
    retryDelayMs?: number;
}

interface QueuedTask {
    key: string;
    request: AnalyzerTaskRequest;
    completions: Array<() => void>;
    attempts: number;
    retryTimeout?: NodeJS.Timeout;
}

export interface AnalyzerOrchestratorOptions {
    defaultRetryAttempts?: number;
    defaultRetryDelayMs?: number;
}

/**
 * Main orchestrator for Dart unused code analysis.
 * Coordinates between workspace analysis, incremental updates, and lifecycle events.
 * 
 * Single Responsibility: Orchestrate high-level analysis workflows and manage state.
 */
export class AnalyzerOrchestrator {
    private readonly taskQueue: QueuedTask[] = [];
    private isProcessingQueue = false;
    private currentTaskKey?: string;
    private unusedReanalysisTimer?: NodeJS.Timeout;
    private currentReanalysisIntervalMs?: number;
    private readonly pendingRetryKeys = new Set<string>();
    private readonly defaultRetryAttempts: number;
    private readonly defaultRetryDelayMs: number;
    private readonly configChangeDisposable: vscode.Disposable;

    constructor(
        private readonly workspaceAnalyzer: WorkspaceAnalyzer,
        private readonly incrementalAnalysisHandler: IncrementalAnalysisHandler,
        private readonly configService: ConfigurationService,
        private readonly diagnostics: Diagnostics,
        private readonly cache: CacheService,
        private readonly logger: Logger,
        options: AnalyzerOrchestratorOptions = {}
    ) {
        this.defaultRetryAttempts = Math.max(0, options.defaultRetryAttempts ?? 2);
        this.defaultRetryDelayMs = Math.max(0, options.defaultRetryDelayMs ?? 250);
        this.refreshReanalysisSchedule();
        this.configChangeDisposable = this.configService.onDidChangeConfiguration((config) => {
            this.logger.debug('Configuration changed, updating orchestrator state');
            this.handleConfigurationChange(config);
        });
    }

    private enqueueTask(request: AnalyzerTaskRequest): Promise<void> {
        const key = this.createTaskKey(request);
        let resolveTask!: () => void;

        const completion = new Promise<void>((resolve) => {
            resolveTask = resolve;
        });

        const task: QueuedTask = {
            key,
            request,
            completions: [resolveTask],
            attempts: 0
        };

        this.taskQueue.push(task);

        void this.processQueue();

        return completion;
    }

    private createTaskKey(request: AnalyzerTaskRequest): string {
        return request.resource ? `${request.type}:${request.resource}` : request.type;
    }

    private isTaskQueuedOrRunning(key: string): boolean {
        if (this.currentTaskKey === key) {
            return true;
        }

        if (this.pendingRetryKeys.has(key)) {
            return true;
        }

        return this.taskQueue.some(task => task.key === key);
    }

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

    private clearReanalysisSchedule(): void {
        if (this.unusedReanalysisTimer) {
            clearInterval(this.unusedReanalysisTimer);
            this.unusedReanalysisTimer = undefined;
        }
        this.currentReanalysisIntervalMs = undefined;
    }

    private handleConfigurationChange(config: AnalyzerConfig): void {
        this.refreshReanalysisSchedule(config);

        if (!config.enabled) {
            this.logger.info('Analyzer disabled via configuration change');
            this.diagnostics.clear();
            StatusBar.hide();
        }
    }

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

        const groupedByFile = this.groupMethodsByFile(cachedMethods);
        const key = AnalyzerTaskType.Reanalysis;

        if (this.isTaskQueuedOrRunning(key)) {
            return;
        }

        await this.enqueueTask({
            type: AnalyzerTaskType.Reanalysis,
            run: async () => {
                StatusBar.showProgress('Reanalyzing unused methods...');
                try {
                    let errorToThrow: unknown | undefined;
                    for (const [filePath, methods] of groupedByFile) {
                        try {
                            await this.incrementalAnalysisHandler.reanalyzeCachedMethods(filePath, methods);
                        } catch (error) {
                            errorToThrow = error;
                            this.logger.error(` Reanalysis failed for ${filePath}: ${this.formatError(error)}`);
                        }
                    }

                    if (errorToThrow) {
                        throw errorToThrow;
                    }
                } finally {
                    StatusBar.hide();
                }
            },
            maxRetries: this.defaultRetryAttempts,
            retryDelayMs: this.defaultRetryDelayMs
        });
    }

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

    private clearRetryTimeout(task: QueuedTask): void {
        if (task.retryTimeout) {
            clearTimeout(task.retryTimeout);
            task.retryTimeout = undefined;
        }
        this.pendingRetryKeys.delete(task.key);
    }

    private scheduleRetry(task: QueuedTask, error: unknown): boolean {
        const retries = task.request.maxRetries ?? this.defaultRetryAttempts;
        if (task.attempts >= retries) {
            this.logger.error(` Task ${task.key} failed after ${task.attempts + 1} attempt(s): ${this.formatError(error)}`);
            this.clearRetryTimeout(task);
            this.taskQueue.shift();
            task.completions.forEach((resolve) => resolve());
            return false;
        }

        task.attempts += 1;
        const remaining = retries - task.attempts + 1;
        const delay = task.request.retryDelayMs ?? this.defaultRetryDelayMs;
        this.logger.warn(` Task ${task.key} failed (will retry ${remaining} more time(s)) in ${delay}ms: ${this.formatError(error)}`);

        this.clearRetryTimeout(task);
        this.pendingRetryKeys.add(task.key);
        task.retryTimeout = setTimeout(() => {
            task.retryTimeout = undefined;
            this.pendingRetryKeys.delete(task.key);
            this.taskQueue.push(task);
            void this.processQueue();
        }, delay);

        this.taskQueue.shift();
        return true;
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.taskQueue.length > 0) {
            const task = this.taskQueue[0];
            this.currentTaskKey = task.key;
            const { request, completions } = task;

            try {
                await request.run();
                this.clearRetryTimeout(task);
                this.taskQueue.shift();
                completions.forEach((resolve) => resolve());
            } catch (error) {
                const scheduled = this.scheduleRetry(task, error);
                if (scheduled) {
                    this.currentTaskKey = undefined;
                    this.isProcessingQueue = false;
                    return;
                }
            }

            this.currentTaskKey = undefined;
        }

        this.currentTaskKey = undefined;
        this.isProcessingQueue = false;
    }

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

        return this.enqueueTask({
            type: AnalyzerTaskType.Workspace,
            run: async () => {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    this.diagnostics.clear();
                    Notifications.showWarning('No workspace folder open');
                    return;
                }

                StatusBar.showProgress();

                try {
                    const unusedCount = await this.workspaceAnalyzer.analyze(workspaceFolders[0].uri.fsPath, config);
                    Notifications.showInfo(`Found ${unusedCount} unused method(s)`);
                } catch (error) {
                    Notifications.showError(`Analysis error: ${this.formatError(error)}`);
                    throw error;
                } finally {
                    StatusBar.hide();
                }
            },
            maxRetries: this.defaultRetryAttempts,
            retryDelayMs: this.defaultRetryDelayMs
        });
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

        return this.enqueueTask({
            type: AnalyzerTaskType.File,
            resource: document.uri.fsPath,
            run: async () => {
                StatusBar.showProgress('Analyzing...');

                try {
                    await this.incrementalAnalysisHandler.handleFileUpdated(document);
                } catch (error) {
                    throw error;
                } finally {
                    StatusBar.hide();
                }
            },
            maxRetries: this.defaultRetryAttempts,
            retryDelayMs: this.defaultRetryDelayMs
        });
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

        return this.enqueueTask({
            type: AnalyzerTaskType.Create,
            resource: createdFilePath,
            run: async () => {
                StatusBar.showProgress('Analyzing...');
                try {
                    await this.incrementalAnalysisHandler.handleFileCreated(createdFilePath);
                } catch (error) {
                    throw error;
                } finally {
                    StatusBar.hide();
                }
            },
            maxRetries: this.defaultRetryAttempts,
            retryDelayMs: this.defaultRetryDelayMs
        });
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

        return this.enqueueTask({
            type: AnalyzerTaskType.Delete,
            resource: deletedFilePath,
            run: async () => {
                StatusBar.showProgress('Processing...');

                try {
                    await this.incrementalAnalysisHandler.handleFileDeleted(deletedFilePath);
                } catch (error) {
                    throw error;
                } finally {
                    StatusBar.hide();
                }
            },
            maxRetries: this.defaultRetryAttempts,
            retryDelayMs: this.defaultRetryDelayMs
        });
    }

    dispose(): void {
        this.clearReanalysisSchedule();
        this.configChangeDisposable.dispose();
        StatusBar.dispose();
    }
}
