import * as vscode from 'vscode';
import * as path from 'path';
import { CacheService } from '../services/cacheService';
import { Diagnostics } from '../infra/diagnostics';
import { VscodeCommands } from '../infra/vscodeCommands';
import { DartPackageUtils } from '../shared/utils/dartPackageUtils';
import { FileSystemUtils } from '../shared/utils/fileSystemUtils';
import { Logger, AnalyzerConfig } from '../shared/types';
import { AnalysisComposer } from './analysisComposer';
import { AnalysisQueue } from './analysisQueue';

/**
 * Handles file lifecycle events by composing and queueing analysis tasks.
 * Unifies file creation, update, and deletion handling.
 */
export class FileAnalysisHandler {
    constructor(
        private readonly analysisQueue: AnalysisQueue,
        private readonly vscodeCommands: VscodeCommands,
        private readonly cache: CacheService,
        private readonly diagnostics: Diagnostics,
        private readonly logger: Logger
    ) { }

    /**
     * Handles file creation by analyzing the new file and its dependencies.
     */
    async handleFileCreation(
        createdFilePath: string,
        excludePatterns: string[],
        workspacePath: string,
        config: AnalyzerConfig
    ): Promise<void> {
        // Check if file should be excluded
        if (FileSystemUtils.shouldExclude(createdFilePath, workspacePath, excludePatterns)) {
            this.logger.debug(`Skipping excluded file: ${createdFilePath}`);
            return;
        }

        this.logger.debug(`File created: ${createdFilePath}`);

        try {
            // Load file and wait for Analysis Server
            const uri = vscode.Uri.file(createdFilePath);
            const document = await vscode.workspace.openTextDocument(uri);
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Compose and enqueue analysis task
            const task = AnalysisComposer.composeFileWithDependenciesAnalysis(createdFilePath);
            this.analysisQueue.enqueue(task);

            // Additionally: Extract method calls to clear now-used methods from cache
            await this.clearNowUsedMethods(document, workspacePath, config);

            this.logger.debug(`Analysis queued for new file: ${createdFilePath}`);
        } catch (error) {
            this.logger.error(`Error handling file creation ${createdFilePath}: ${error}`);
        }
    }

    /**
     * Handles file updates by analyzing the file and its dependencies.
     */
    async handleFileUpdate(
        filePath: string,
        excludePatterns: string[],
        workspacePath: string,
        config: AnalyzerConfig
    ): Promise<void> {
        // Check if file should be excluded
        if (FileSystemUtils.shouldExclude(filePath, workspacePath, excludePatterns)) {
            return;
        }

        this.logger.debug(`File updated: ${filePath}`);

        try {
            // Compose and enqueue analysis task
            const task = AnalysisComposer.composeFileWithDependenciesAnalysis(filePath);
            this.analysisQueue.enqueue(task);

            this.logger.debug(`Analysis queued for updated file: ${filePath}`);
        } catch (error) {
            this.logger.error(`Error handling file update ${filePath}: ${error}`);
        }
    }

    /**
     * Handles file deletion by clearing cache and analyzing dependents.
     */
    async handleFileDeletion(
        deletedFilePath: string,
        excludePatterns: string[],
        workspacePath: string,
        config: AnalyzerConfig
    ): Promise<void> {
        this.logger.debug(`File deleted: ${deletedFilePath}`);

        try {
            // Compose and enqueue deletion analysis task
            const task = AnalysisComposer.composeFileDeletionAnalysis(deletedFilePath);
            this.analysisQueue.enqueue(task);

            this.logger.debug(`Deletion analysis queued for: ${deletedFilePath}`);
        } catch (error) {
            this.logger.error(`Error handling file deletion ${deletedFilePath}: ${error}`);
        }
    }

    /**
     * Extracts method calls from a document and removes them from the unused cache.
     * This handles the case where a new file uses previously unused methods.
     */
    private async clearNowUsedMethods(
        document: vscode.TextDocument,
        workspacePath: string,
        config: AnalyzerConfig
    ): Promise<void> {
        try {
            this.logger.debug(`Extracting method calls to clear now-used methods`);
            const methodCallsNowUsed = await this.extractMethodCallDefinitions(document, workspacePath);
            this.logger.debug(`Found ${methodCallsNowUsed.length} method call definitions`);

            // Remove each method from cache if it exists
            let removedCount = 0;
            for (const methodDef of methodCallsNowUsed) {
                const cachedMethod = this.cache.get(methodDef.filePath, methodDef.line);
                if (cachedMethod) {
                    this.logger.debug(
                        `Removing now-used method: ${cachedMethod.name} at ${methodDef.filePath}:${methodDef.line}`
                    );
                    this.cache.remove(cachedMethod);

                    // Update diagnostics for that file
                    const remainingUnused = this.cache.getForFile(methodDef.filePath);
                    if (remainingUnused.length === 0) {
                        this.diagnostics.clearFile(methodDef.filePath);
                    } else {
                        this.diagnostics.clearFile(methodDef.filePath);
                        for (const method of remainingUnused) {
                            this.diagnostics.reportUnusedMethod(method, config);
                        }
                    }
                    removedCount++;
                }
            }

            this.logger.debug(`Cleared ${removedCount} now-used methods from cache`);
        } catch (error) {
            this.logger.error(`Error clearing now-used methods: ${error}`);
        }
    }

    /**
     * Extracts method call definitions from a document using semantic tokens.
     * Returns file paths and line numbers of the method definitions.
     */
    private async extractMethodCallDefinitions(
        document: vscode.TextDocument,
        workspacePath: string
    ): Promise<Array<{ filePath: string; line: number }>> {
        const definitions: Array<{ filePath: string; line: number }> = [];
        const seenDefinitions = new Set<string>();

        try {
            const legend = await this.vscodeCommands.getSemanticTokensLegend(document.uri);
            const semanticTokens = await this.vscodeCommands.getSemanticTokens(document.uri);

            if (!semanticTokens || !semanticTokens.data || !legend) {
                this.logger.trace(`No semantic tokens available for method call extraction`);
                return definitions;
            }

            // Find method/function token types
            const methodTypeIndices = new Set<number>();
            legend.tokenTypes.forEach((type, index) => {
                if (type === 'method' || type === 'function') {
                    methodTypeIndices.add(index);
                }
            });

            // Find declaration modifier
            const declarationModifierIndex = legend.tokenModifiers.indexOf('declaration');
            const declarationModifierBit =
                declarationModifierIndex >= 0 ? 1 << declarationModifierIndex : 0;

            if (methodTypeIndices.size === 0) {
                this.logger.trace(`No method/function token types found`);
                return definitions;
            }

            // Parse semantic tokens to find method calls (not declarations)
            const data = semanticTokens.data;
            let line = 0;
            let character = 0;

            for (let i = 0; i < data.length; i += 5) {
                const deltaLine = data[i];
                const deltaStart = data[i + 1];
                const tokenType = data[i + 3];
                const tokenModifiers = data[i + 4];

                // Update position
                if (deltaLine > 0) {
                    line += deltaLine;
                    character = deltaStart;
                } else {
                    character += deltaStart;
                }

                const isMethodLike = methodTypeIndices.has(tokenType);
                const isDeclaration =
                    declarationModifierBit !== 0 && (tokenModifiers & declarationModifierBit) !== 0;

                // We want method calls (not declarations)
                if (isMethodLike && !isDeclaration) {
                    const position = new vscode.Position(line, character);

                    try {
                        const defs = await this.vscodeCommands.getDefinitions(document.uri, position);

                        if (defs && defs.length > 0) {
                            for (const def of defs) {
                                const { filePath: defPath, line: defLine } =
                                    this.vscodeCommands.extractDefinitionLocation(def);

                                // Skip same file
                                if (defPath === document.uri.fsPath) {
                                    continue;
                                }

                                // Skip external packages
                                const normalizedDefPath = defPath.split(path.sep).join('/');
                                if (
                                    normalizedDefPath.includes('.pub-cache') ||
                                    normalizedDefPath.includes('/.dart_tool/')
                                ) {
                                    continue;
                                }

                                // Only track definitions from the same package
                                if (DartPackageUtils.isInSamePackage(document.uri.fsPath, defPath)) {
                                    const defKey = `${defPath}:${defLine}`;

                                    if (!seenDefinitions.has(defKey)) {
                                        seenDefinitions.add(defKey);
                                        definitions.push({ filePath: defPath, line: defLine });
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        // Skip - couldn't resolve definition
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Error extracting method call definitions: ${error}`);
        }

        return definitions;
    }
}
