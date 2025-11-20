import * as vscode from 'vscode';

/**
 * Infrastructure wrapper for VS Code command API calls.
 * Centralizes interaction with VS Code's language services.
 * 
 * Single Responsibility: Provide a clean interface to VS Code command execution.
 * 
 * @see https://code.visualstudio.com/api/references/commands - VS Code Commands API reference
 */
export class VscodeCommands {
    /**
     * Gets the semantic tokens legend for a document.
     * Returns token type and modifier names used in semantic highlighting.
     * @throws Error if the command fails or returns no result
     */
    async getSemanticTokensLegend(uri: vscode.Uri): Promise<vscode.SemanticTokensLegend> {
        const result = await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
            'vscode.provideDocumentSemanticTokensLegend',
            uri
        );
        if (!result) {
            throw new Error(`No semantic tokens legend available for ${uri.fsPath}`);
        }
        return result;
    }

    /**
     * Gets semantic tokens for a document.
     * Returns encoded token data for syntax highlighting and code analysis.
     * @throws Error if the command fails or returns no result
     */
    async getSemanticTokens(uri: vscode.Uri): Promise<vscode.SemanticTokens> {
        const result = await vscode.commands.executeCommand<vscode.SemanticTokens>(
            'vscode.provideDocumentSemanticTokens',
            uri
        );
        if (!result) {
            throw new Error(`No semantic tokens available for ${uri.fsPath}`);
        }
        return result;
    }

    /**
     * Gets document symbols (AST-based) for a document.
     * Returns class, method, function, and variable declarations.
     * @throws Error if the command fails or returns no result
     */
    async getDocumentSymbols(uri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
        const result = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            uri
        );
        if (!result) {
            throw new Error(`No document symbols available for ${uri.fsPath}`);
        }
        return result;
    }

    /**
     * Finds the definition(s) of a symbol at a specific position.
     * Returns locations where the symbol is defined.
     * @throws Error if the command fails or returns no result
     */
    async getDefinitions(
        uri: vscode.Uri,
        position: vscode.Position
    ): Promise<(vscode.Location | vscode.LocationLink)[]> {
        const result = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
            'vscode.executeDefinitionProvider',
            uri,
            position
        );
        if (!result) {
            throw new Error(`No definitions found at ${uri.fsPath}:${position.line}:${position.character}`);
        }
        return result;
    }

    /**
     * Finds all references to a symbol at a specific position.
     * Returns locations where the symbol is used, or empty array if none found.
     * 
     * Note: An empty result is a valid outcome (indicates unused symbol),
     * not an error condition.
     */
    async getReferences(
        uri: vscode.Uri,
        position: vscode.Position
    ): Promise<vscode.Location[]> {
        const result = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeReferenceProvider',
            uri,
            position
        );
        // Return empty array if no references found - this is a valid state
        return result || [];
    }

    /**
     * Extracts file path and line number from a definition result.
     * Handles both Location and LocationLink types.
     */
    extractDefinitionLocation(def: vscode.Location | vscode.LocationLink): { filePath: string; line: number } {
        if ('targetUri' in def) {
            // LocationLink
            return {
                filePath: def.targetUri.fsPath,
                line: def.targetRange.start.line
            };
        } else {
            // Location
            return {
                filePath: def.uri.fsPath,
                line: def.range.start.line
            };
        }
    }
}
