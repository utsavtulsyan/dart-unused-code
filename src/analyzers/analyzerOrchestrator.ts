import * as vscode from 'vscode';
import { ConfigurationService } from '../services/configurationService';
import { Diagnostics, StatusBar, Notifications } from '../infra';
import { WorkspaceAnalyzer } from '../core/workspaceAnalyzer';
import { IncrementalAnalysisHandler } from '../handlers/incrementalAnalysisHandler';
import { FileSystemUtils } from '../shared/utils/fileSystemUtils';
import { Logger } from '../shared/types';

/**
 * Main orchestrator for Dart unused code analysis.
 * Coordinates between workspace analysis, incremental updates, and lifecycle events.
 * 
 * Single Responsibility: Orchestrate high-level analysis workflows and manage state.
 */
export class AnalyzerOrchestrator {
    private isAnalyzing = false;

    constructor(
        private readonly workspaceAnalyzer: WorkspaceAnalyzer,
        private readonly incrementalAnalysisHandler: IncrementalAnalysisHandler,
        private readonly configService: ConfigurationService,
        private readonly diagnostics: Diagnostics,
        private readonly logger: Logger
    ) {}

    /**
     * Analyzes the entire workspace for unused methods.
     */
    async analyzeWorkspace(): Promise<void> {
        if (this.isAnalyzing) {
            this.logger.warn('Analysis already in progress');
            return;
        }

        const config = this.configService.getConfiguration();
        if (!config.enabled) {
            Notifications.showInfo('Dart Unused Code: disabled');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            this.diagnostics.clear();
            Notifications.showWarning('No workspace folder open');
            return;
        }

        this.isAnalyzing = true;
        StatusBar.showProgress();

        try {
            const unusedCount = await this.workspaceAnalyzer.analyze(workspaceFolders[0].uri.fsPath, config);
            Notifications.showInfo(`Found ${unusedCount} unused method(s)`);
        } catch (error) {
            Notifications.showError(`Analysis error: ${error}`);
            this.logger.error(` ${error}`);
        } finally {
            StatusBar.hide();
            this.isAnalyzing = false;
        }
    }

    /**
     * Analyzes a single file incrementally when it's saved.
     */
    async analyzeFile(document: vscode.TextDocument): Promise<void> {
        if (this.isAnalyzing) {
            return;
        }

        // Check if file should be excluded
        const config = this.configService.getConfiguration();
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

        this.isAnalyzing = true;
        StatusBar.showProgress('Analyzing...');

        try {
            await this.incrementalAnalysisHandler.handleFileUpdated(document);
        } catch (error) {
            this.logger.error(` ${error}`);
        } finally {
            StatusBar.hide();
            this.isAnalyzing = false;
        }
    }

    /**
     * Handles the creation of a new file.
     */
    async handleFileCreated(createdFilePath: string): Promise<void> {
        StatusBar.showProgress('Analyzing...');
        try {
            await this.incrementalAnalysisHandler.handleFileCreated(createdFilePath);
        } finally {
            StatusBar.hide();
        }
    }

    /**
     * Handles the deletion of a file.
     */
    async handleFileDeleted(deletedFilePath: string): Promise<void> {
        if (this.isAnalyzing) {
            return;
        }

        this.isAnalyzing = true;
        StatusBar.showProgress('Processing...');

        try {
            await this.incrementalAnalysisHandler.handleFileDeleted(deletedFilePath);
        } catch (error) {
            this.logger.error(` ${error}`);
        } finally {
            StatusBar.hide();
            this.isAnalyzing = false;
        }
    }

    dispose(): void {
        StatusBar.dispose();
    }
}
