import * as vscode from 'vscode';
import { MethodInfo } from '../../shared/types';

/**
 * Creates a mock VS Code document symbol.
 */
export function createMockSymbol(
    name: string,
    kind: vscode.SymbolKind,
    range: vscode.Range,
    children?: vscode.DocumentSymbol[]
): vscode.DocumentSymbol {
    return {
        name,
        detail: '',
        kind,
        range,
        selectionRange: range,
        children: children || []
    };
}

/**
 * Creates a mock method info object for testing.
 */
export function createMockMethodInfo(
    name: string,
    filePath: string,
    line: number,
    options: Partial<MethodInfo> = {}
): MethodInfo {
    return {
        name,
        filePath,
        range: new vscode.Range(line, 0, line, 10),
        isPrivate: name.startsWith('_'),
        className: options.className,
        ...options
    };
}

/**
 * Creates a mock VS Code location.
 */
export function createMockLocation(
    uri: vscode.Uri,
    line: number,
    character: number = 0
): vscode.Location {
    return new vscode.Location(
        uri,
        new vscode.Position(line, character)
    );
}

/**
 * Creates a mock diagnostic collection for testing.
 */
export class MockDiagnosticCollection implements vscode.DiagnosticCollection {
    name = 'mock-diagnostics';
    private diagnostics = new Map<string, vscode.Diagnostic[]>();

    set(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]): void;
    set(entries: ReadonlyArray<[vscode.Uri, vscode.Diagnostic[]]>): void;
    set(uriOrEntries: any, diagnostics?: any): void {
        if (Array.isArray(uriOrEntries)) {
            for (const [uri, diags] of uriOrEntries) {
                this.diagnostics.set(uri.toString(), diags);
            }
        } else {
            this.diagnostics.set(uriOrEntries.toString(), diagnostics);
        }
    }

    delete(uri: vscode.Uri): void {
        this.diagnostics.delete(uri.toString());
    }

    clear(): void {
        this.diagnostics.clear();
    }

    forEach(callback: (uri: vscode.Uri, diagnostics: vscode.Diagnostic[], collection: vscode.DiagnosticCollection) => any): void {
        this.diagnostics.forEach((diags, uriStr) => {
            callback(vscode.Uri.parse(uriStr), diags, this);
        });
    }

    get(uri: vscode.Uri): vscode.Diagnostic[] | undefined {
        return this.diagnostics.get(uri.toString());
    }

    has(uri: vscode.Uri): boolean {
        return this.diagnostics.has(uri.toString());
    }

    dispose(): void {
        this.clear();
    }

    [Symbol.iterator](): Iterator<[uri: vscode.Uri, diagnostics: readonly vscode.Diagnostic[]]> {
        const entries = Array.from(this.diagnostics.entries()).map(
            ([uriStr, diags]) => [vscode.Uri.parse(uriStr), diags] as [vscode.Uri, readonly vscode.Diagnostic[]]
        );
        return entries[Symbol.iterator]();
    }
}
