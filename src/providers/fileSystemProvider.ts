import * as vscode from 'vscode';
import { AnalyzerOrchestrator } from '../analyzers/analyzerOrchestrator';
import { Logger } from '../shared/types';

/**
 * Handles file system events (create, delete) for lifecycle management.
 * 
 * Single Responsibility: React to file system changes and update analysis accordingly.
 */
export class FileSystemProvider {
    private readonly logger: Logger;

    constructor(
        private readonly orchestrator: AnalyzerOrchestrator,
        logger: Logger
    ) {
        this.logger = logger;
    }

    register(context: vscode.ExtensionContext): void {
        // Watch for file creation
        const fsWatcher = vscode.workspace.createFileSystemWatcher(
            '**/*.dart',
            false, // ignoreCreateEvents
            true,  // ignoreChangeEvents - handled by save watcher
            true   // ignoreDeleteEvents - handled by onDidDeleteFiles
        );

        fsWatcher.onDidCreate((uri) => {
            this.logger.debug(`File created: ${uri.fsPath}`);
            this.orchestrator.handleFileCreated(uri.fsPath);
        });

        context.subscriptions.push(fsWatcher);

        // Watch for file deletion
        const deleteWatcher = vscode.workspace.onDidDeleteFiles((event) => {
            for (const uri of event.files) {
                if (uri.fsPath.endsWith('.dart')) {
                    this.logger.debug(`File deleted: ${uri.fsPath}`);
                    this.orchestrator.handleFileDeleted(uri.fsPath);
                }
            }
        });

        context.subscriptions.push(deleteWatcher);
    }
}
