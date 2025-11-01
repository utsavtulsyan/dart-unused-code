import * as vscode from 'vscode';
import { MethodInfo, Logger } from '../shared/types';
import { Result, ResultUtils } from '../shared/utils/result';
import { VscodeCommands } from '../infra/vscodeCommands';

/**
 * Extracts method declarations from Dart files using AST.
 * Single Responsibility: Method extraction from document symbols.
 */
export class MethodExtractor {
    private static readonly EXCLUDED_METHOD_NAMES = ['main', 'build'];
    private static readonly EXCLUDED_PREFIXES = ['get ', 'set ', 'test'];

    constructor(
        private readonly vscodeCommands: VscodeCommands,
        private readonly logger: Logger
    ) {}

    /**
     * Extracts all method declarations from a Dart file using VS Code's Document Symbol Provider.
     */
    async extractMethods(filePath: string): Promise<MethodInfo[]> {
        const result = await this.extractMethodsFromFile(filePath);
        if (result.success) {
            return result.data;
        } else {
            this.logger.warn(`Error extracting methods from ${filePath}: ${result.error.message}`);
            return [];
        }
    }

    /**
     * Internal method that performs the actual extraction
     */
    private async extractMethodsFromFile(filePath: string): Promise<Result<MethodInfo[], Error>> {
        return ResultUtils.fromPromise((async () => {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const symbols = await this.vscodeCommands.getDocumentSymbols(uri);

            if (!symbols) {
                return [];
            }

            const methods: MethodInfo[] = [];
            this.extractMethodsFromSymbols(symbols, filePath, document, methods);
            
            if (methods.length > 0) {
                if (this.logger.isLevelEnabled(1 /* DEBUG */)) {
                    this.logger.debug(`Extracted ${methods.length} methods from ${filePath}`);
                }
            }

            return methods;
        })());
    }

    private extractMethodsFromSymbols(
        symbols: vscode.DocumentSymbol[], 
        filePath: string,
        document: vscode.TextDocument,
        methods: MethodInfo[],
        parentClassName?: string
    ): void {
        for (const symbol of symbols) {
            // Track class names as we traverse
            const currentClassName = symbol.kind === vscode.SymbolKind.Class ? symbol.name : parentClassName;

            if (this.isValidMethod(symbol, document)) {
                methods.push({
                    name: symbol.name,
                    filePath: filePath,
                    range: symbol.selectionRange,
                    isPrivate: symbol.name.startsWith('_'),
                    className: currentClassName
                });
            }

            // Recursively process children with class context
            if (symbol.children && symbol.children.length > 0) {
                this.extractMethodsFromSymbols(symbol.children, filePath, document, methods, currentClassName);
            }
        }
    }

    private isValidMethod(symbol: vscode.DocumentSymbol, document: vscode.TextDocument): boolean {
        if (symbol.kind !== vscode.SymbolKind.Method && symbol.kind !== vscode.SymbolKind.Function) {
            return false;
        }

        const name = symbol.name;



        // Exclude specific method names
        if (MethodExtractor.EXCLUDED_METHOD_NAMES.includes(name)) {
            return false;
        }

        // Exclude getters, setters, and test methods by prefix
        if (MethodExtractor.EXCLUDED_PREFIXES.some(prefix => name.startsWith(prefix))) {
            return false;
        }

        // Check for @test annotation in the source code
        if (this.hasTestAnnotation(symbol, document)) {
            return false;
        }

        // Check for @override annotation
        if (this.hasOverrideAnnotation(symbol, document)) {
            return false;
        }
        return true;
    }

    private hasOverrideAnnotation(symbol: vscode.DocumentSymbol, document: vscode.TextDocument): boolean {
        // Check the line immediately before the method and the method line itself
        const methodLine = symbol.range.start.line;
        const linesToCheck = [Math.max(0, methodLine - 1), methodLine];
        
        for (const lineNum of linesToCheck) {
            const lineText = document.lineAt(lineNum).text.trim();
            if (lineText.includes('@override') || lineText.includes('@Override')) {
                return true;
            }
        }
        
        return false;
    }

    private hasTestAnnotation(symbol: vscode.DocumentSymbol, document: vscode.TextDocument): boolean {
        // Get a few lines before the method to check for annotations
        const startLine = Math.max(0, symbol.range.start.line - 5);
        const endLine = symbol.range.start.line;
        
        for (let i = startLine; i <= endLine; i++) {
            const lineText = document.lineAt(i).text.trim();
            if (lineText.startsWith('@test') || lineText.startsWith('@Test')) {
                return true;
            }
        }
        
        return false;
    }


}
