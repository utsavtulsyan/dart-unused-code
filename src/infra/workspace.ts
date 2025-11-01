import * as vscode from 'vscode';

/**
 * Wrapper for VS Code workspace API.
 * Single Responsibility: Workspace and document operations.
 */
export class Workspace {
    /**
     * Opens a document and waits for the Dart Analysis Server to process it.
     */
    static async loadDocument(filePath: string, delayMs: number = 2000): Promise<vscode.TextDocument> {
        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return document;
    }
}
