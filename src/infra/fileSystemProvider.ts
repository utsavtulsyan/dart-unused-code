import * as vscode from 'vscode';
import { AnalyzerOrchestrator } from '../analyzers/analyzerOrchestrator';
import { Logger } from '../shared/types';

/**
 * Handles all file system events (create, change, delete) for analysis lifecycle.
 * Uses FileSystemWatcher to detect all file changes, including external ones
 * (like git operations, branch switches) that workspace events miss.
 */
export class FileSystemProvider {
    constructor(
        private readonly orchestrator: AnalyzerOrchestrator,
        private readonly logger: Logger
    ) { }

    register(context: vscode.ExtensionContext): void {
        // FileSystemWatcher catches ALL file changes on disk, including:
        // - User actions (create/save/delete from editor/explorer)
        // - External changes (git, other apps, branch switches, git pull)
        //
        // workspace.onDidCreateFiles/onDidDeleteFiles only catch user gestures, NOT external changes
        // workspace.onDidSaveTextDocument only fires for in-editor saves, NOT external changes
        const watcher = vscode.workspace.createFileSystemWatcher(
            '**/*.dart',
            false, // Don't ignore create events
            false, // Don't ignore change events (file saves/modifications)
            false  // Don't ignore delete events
        );

        watcher.onDidCreate((uri) => {
            this.logger.debug(`File created: ${uri.fsPath}`);
            void this.orchestrator.handleFileCreated(uri.fsPath);
        });

        watcher.onDidChange((uri) => {
            this.logger.debug(`File changed: ${uri.fsPath}`);
            void this.orchestrator.handleFileChanged(uri.fsPath);
        });

        watcher.onDidDelete((uri) => {
            this.logger.debug(`File deleted: ${uri.fsPath}`);
            void this.orchestrator.handleFileDeleted(uri.fsPath);
        });

        context.subscriptions.push(watcher);
    }
}
