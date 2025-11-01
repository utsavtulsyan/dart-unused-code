import * as vscode from 'vscode';
import { AnalyzerOrchestrator } from '../analyzers/analyzerOrchestrator';
import { Logger } from '../shared/types';

/**
 * Handles document save events for incremental analysis.
 * 
 * Single Responsibility: React to document save events and trigger analysis.
 */
export class DocumentSaveProvider {
    private readonly logger: Logger;

    constructor(
        private readonly orchestrator: AnalyzerOrchestrator,
        logger: Logger
    ) {
        this.logger = logger;
    }

    register(context: vscode.ExtensionContext): void {
        const saveWatcher = vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.languageId === 'dart') {
                this.logger.debug(`Analyzing saved file: ${document.uri.fsPath}`);
                this.orchestrator.analyzeFile(document);
            }
        });
        context.subscriptions.push(saveWatcher);
    }
}
