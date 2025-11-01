import * as vscode from 'vscode';
import { ConfigurationService } from '../services/configurationService';
import { MetricsService } from '../services/metricsService';
import { FileUpdateHandler } from './fileUpdateHandler';
import { FileCreationHandler } from './fileCreationHandler';
import { FileDeletionHandler } from './fileDeletionHandler';
import { Logger } from '../shared/types';

/**
 * Handles all incremental analysis operations (file save, creation, deletion).
 * Single Responsibility: Coordinate incremental analysis workflows.
 */
export class IncrementalAnalysisHandler {
    constructor(
        private readonly configService: ConfigurationService,
        private readonly metricsService: MetricsService,
        private readonly updateHandler: FileUpdateHandler,
        private readonly creationHandler: FileCreationHandler,
        private readonly deletionHandler: FileDeletionHandler,
        private readonly logger: Logger
    ) {}

    /**
     * Analyzes a single file incrementally when it's updated/saved.
     */
    async handleFileUpdated(document: vscode.TextDocument): Promise<void> {
        const config = this.configService.getConfiguration();
        if (!config.enabled) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const analysisMetrics = this.metricsService.startAnalysis(true);
        
        try {
            await this.updateHandler.handle(
                document.uri.fsPath,
                config.excludePatterns || [],
                workspaceFolder.uri.fsPath,
                config,
                analysisMetrics
            );
        } catch (error) {
            this.logger.error(`Error: ${error}`);
        } finally {
            this.metricsService.finishAnalysis(analysisMetrics);
            this.logger.debug(this.metricsService.getPerformanceReport());
        }
    }

    /**
     * Handles the creation of a new file.
     */
    async handleFileCreated(createdFilePath: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const config = this.configService.getConfiguration();
        await this.creationHandler.handle(
            createdFilePath,
            config.excludePatterns || [],
            workspaceFolder.uri.fsPath,
            config
        );
    }

    /**
     * Handles the deletion of a file.
     */
    async handleFileDeleted(deletedFilePath: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        try {
            const config = this.configService.getConfiguration();
            await this.deletionHandler.handle(
                deletedFilePath,
                config.excludePatterns || [],
                workspaceFolder.uri.fsPath,
                config
            );
        } catch (error) {
            this.logger.error(`Error in file deletion handling: ${error}`);
        }
    }
}
