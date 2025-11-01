import * as vscode from 'vscode';
import { MethodInfo, AnalyzerConfig } from '../shared/types';

/**
 * Wrapper for VS Code diagnostics API.
 * Single Responsibility: Transform MethodInfo into VS Code diagnostics.
 * Stateless - diagnostics are derived from cache/method data.
 */
export class Diagnostics {
    private readonly diagnosticCollection: vscode.DiagnosticCollection;

    constructor(diagnosticCollection: vscode.DiagnosticCollection) {
        this.diagnosticCollection = diagnosticCollection;
    }

    /**
     * Clears all diagnostics.
     */
    clear(): void {
        this.diagnosticCollection.clear();
    }

    /**
     * Clears diagnostics for a specific file.
     */
    clearFile(filePath: string): void {
        const uri = vscode.Uri.file(filePath);
        this.diagnosticCollection.delete(uri);
    }

    /**
     * Reports unused methods for a specific file.
     * Replaces any existing diagnostics for that file.
     */
    reportUnusedMethodsForFile(filePath: string, methods: MethodInfo[], config: AnalyzerConfig): void {
        const uri = vscode.Uri.file(filePath);
        
        if (methods.length === 0) {
            this.diagnosticCollection.delete(uri);
            return;
        }

        const diagnostics = methods.map(method => this.createDiagnostic(method, config.severity));
        this.diagnosticCollection.set(uri, diagnostics);
    }

    /**
     * Reports a single unused method immediately.
     * Useful for incremental updates without recreating all diagnostics.
     */
    reportUnusedMethod(method: MethodInfo, config: AnalyzerConfig): void {
        const uri = vscode.Uri.file(method.filePath);
        const existingDiagnostics = this.diagnosticCollection.get(uri) || [];
        
        const diagnostic = this.createDiagnostic(method, config.severity);
        const updatedDiagnostics = [...existingDiagnostics, diagnostic];
        
        this.diagnosticCollection.set(uri, updatedDiagnostics);
    }

    /**
     * Reports unused methods for multiple files.
     * Groups by file and applies diagnostics efficiently.
     */
    reportUnusedMethods(unusedMethods: MethodInfo[], config: AnalyzerConfig): void {
        const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();

        for (const method of unusedMethods) {
            const diagnostic = this.createDiagnostic(method, config.severity);
            const uriString = vscode.Uri.file(method.filePath).toString();
            
            const diagnostics = diagnosticsMap.get(uriString) || [];
            diagnostics.push(diagnostic);
            diagnosticsMap.set(uriString, diagnostics);
        }

        // Apply all diagnostics
        for (const [uriString, diagnostics] of diagnosticsMap) {
            this.diagnosticCollection.set(vscode.Uri.parse(uriString), diagnostics);
        }

        // Show summary message
        vscode.window.showInformationMessage(
            `Found ${unusedMethods.length} unused public method(s)`
        );
    }

    private createDiagnostic(method: MethodInfo, severity: vscode.DiagnosticSeverity): vscode.Diagnostic {
        const diagnostic = new vscode.Diagnostic(
            method.range,
            `Unused public method '${method.name}' - not referenced in workspace`,
            severity
        );
        
        diagnostic.source = 'Dart Unused Code';
        diagnostic.code = 'unused-public-method';
        
        return diagnostic;
    }
}
