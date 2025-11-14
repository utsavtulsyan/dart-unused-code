import * as vscode from 'vscode';
import { ConfigurationService } from '../services/configurationService';
import { Diagnostics, StatusBar, Notifications } from '../infra';
import { WorkspaceAnalyzer } from '../core/workspaceAnalyzer';
import { IncrementalAnalysisHandler } from '../handlers/incrementalAnalysisHandler';
import { FileSystemUtils } from '../shared/utils/fileSystemUtils';
import { Logger } from '../shared/types';

enum AnalyzerTaskType {
    Workspace = 'workspace',
    File = 'file',
    Create = 'create',
    Delete = 'delete'
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
    private readonly defaultRetryAttempts: number;
    private readonly defaultRetryDelayMs: number;

    constructor(
        private readonly workspaceAnalyzer: WorkspaceAnalyzer,
        private readonly incrementalAnalysisHandler: IncrementalAnalysisHandler,
        private readonly configService: ConfigurationService,
        private readonly diagnostics: Diagnostics,
        private readonly logger: Logger,
        options: AnalyzerOrchestratorOptions = {}
    ) {
        this.defaultRetryAttempts = Math.max(0, options.defaultRetryAttempts ?? 2);
        this.defaultRetryDelayMs = Math.max(0, options.defaultRetryDelayMs ?? 250);
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

    private clearRetryTimeout(task: QueuedTask): void {
        if (task.retryTimeout) {
            clearTimeout(task.retryTimeout);
            task.retryTimeout = undefined;
        }
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
        task.retryTimeout = setTimeout(() => {
            task.retryTimeout = undefined;
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
            const { request, completions } = task;

            try {
                await request.run();
                this.clearRetryTimeout(task);
                this.taskQueue.shift();
                completions.forEach((resolve) => resolve());
            } catch (error) {
                const scheduled = this.scheduleRetry(task, error);
                if (scheduled) {
                    this.isProcessingQueue = false;
                    return;
                }
            }
        }

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
     * Analyzes a single file incrementally when it's saved.
     */
    async analyzeFile(document: vscode.TextDocument): Promise<void> {
        const config = this.configService.getConfiguration();
        if (!config.enabled) {
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
        StatusBar.dispose();
    }
}
