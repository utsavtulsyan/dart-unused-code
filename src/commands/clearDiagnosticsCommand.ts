import * as vscode from 'vscode';
import { Diagnostics } from '../infra/diagnostics';

/**
 * Command handler for clearing diagnostics.
 * Responsibility: Handle the user's request to clear all diagnostics.
 */
export class ClearDiagnosticsCommand {
    constructor(private readonly diagnostics: Diagnostics) {}

    execute() {
        this.diagnostics.clear();
    }

    /**
     * Registers the command with VS Code.
     */
    register(context: vscode.ExtensionContext): vscode.Disposable {
        // Check if command already exists to avoid duplicate registration errors in tests
        try {
            const disposable = vscode.commands.registerCommand(
                'dartUnusedCode.clearDiagnostics',
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
