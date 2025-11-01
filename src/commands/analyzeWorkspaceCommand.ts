import * as vscode from 'vscode';
import { AnalyzerOrchestrator } from '../analyzers/analyzerOrchestrator';

/**
 * Command handler for workspace analysis.
 * Responsibility: Handle the user's request to analyze the entire workspace.
 */
export class AnalyzeWorkspaceCommand {
    constructor(private readonly orchestrator: AnalyzerOrchestrator) {}

    async execute(): Promise<void> {
        await this.orchestrator.analyzeWorkspace();
    }

    /**
     * Registers the command with VS Code.
     */
    register(context: vscode.ExtensionContext): vscode.Disposable {
        // Check if command already exists to avoid duplicate registration errors in tests
        try {
            const disposable = vscode.commands.registerCommand(
                'dartUnusedCode.analyzeWorkspace',
                () => this.execute()
            );
            
            context.subscriptions.push(disposable);
            return disposable;
        } catch (error) {
            // Command already registered, create a no-op disposable and still add to subscriptions
            const noopDisposable = { dispose: () => {} };
            context.subscriptions.push(noopDisposable);
            return noopDisposable;
        }
    }
}
