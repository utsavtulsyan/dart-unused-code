import * as vscode from 'vscode';

/**
 * Wrapper for VS Code notification/message APIs.
 * Single Responsibility: User notifications and messages.
 */
export class Notifications {
    static showInfo(message: string): void {
        vscode.window.showInformationMessage(message);
    }

    static showWarning(message: string): void {
        vscode.window.showWarningMessage(message);
    }

    static showError(message: string): void {
        vscode.window.showErrorMessage(message);
    }
}
