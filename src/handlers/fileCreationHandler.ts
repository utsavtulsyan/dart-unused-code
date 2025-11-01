import * as vscode from 'vscode';
import * as path from 'path';
import { CacheService } from '../services/cacheService';
import { Diagnostics, Workspace } from '../infra';
import { DependencyTrackerService } from '../services/dependencyTrackerService';
import { MethodAnalyzer } from '../core/methodAnalyzer';
import { DependencyDiscovery } from '../core/dependencyDiscovery';
import { MethodInfo, Logger } from '../shared/types';
import { VscodeCommands } from '../infra/vscodeCommands';
import { DartPackageUtils } from '../shared/utils/dartPackageUtils';
import { FileSystemUtils } from '../shared/utils/fileSystemUtils';

/**
 * Handles file creation events.
 * Single Responsibility: Analyze newly created files and update analysis state.
 */
export class FileCreationHandler {
    constructor(
        private readonly vscodeCommands: VscodeCommands,
        private readonly cache: CacheService,
        private readonly methodAnalyzer: MethodAnalyzer,
        private readonly dependencyTracker: DependencyTrackerService,
        private readonly dependencyDiscovery: DependencyDiscovery,
        private readonly diagnostics: Diagnostics,
        private readonly logger: Logger
    ) {}

    async handle(
        createdFilePath: string,
        excludePatterns: string[],
        workspacePath: string,
        config: any
    ): Promise<void> {
        // Check if file should be excluded
        if (FileSystemUtils.shouldExclude(createdFilePath, workspacePath, excludePatterns)) {
            this.logger.debug(`Skipping excluded file: ${createdFilePath}`);
            return;
        }

        this.logger.debug(`New file created: ${createdFilePath}`);
        
        try {
            // Load file and find references
            const uri = vscode.Uri.file(createdFilePath);
            const document = await vscode.workspace.openTextDocument(uri);
            await new Promise(resolve => setTimeout(resolve, 2000));

            const currentReferences = await this.dependencyDiscovery.findFileDependencies(document, workspacePath);
            this.logger.debug(`Found ${currentReferences.size} file dependencies in new file`);

            // Update dependencies
            this.dependencyTracker.setDependencies(createdFilePath, currentReferences);

            // Analyze new file for unused methods it defines
            const result = await this.methodAnalyzer.analyzeMethodsInFile(
                createdFilePath,
                excludePatterns,
                workspacePath,
                config
            );
            this.cache.updateFile(createdFilePath, result.unused);

            // Extract method calls from the new file and check if they were previously marked as unused
            this.logger.debug(`Extracting method calls to update diagnostics for now-used methods`);
            const methodCallsNowUsed = await this.extractMethodCallDefinitions(document, workspacePath);
            this.logger.debug(`Found ${methodCallsNowUsed.length} method call definitions in new file`);

            // For each method definition, check if it was in the cache and remove it
            let removedCount = 0;
            for (const methodDef of methodCallsNowUsed) {
                const cachedMethod = this.cache.get(methodDef.filePath, methodDef.line);
                if (cachedMethod) {
                    this.logger.debug(`Removing now-used method from cache: ${cachedMethod.name} at ${methodDef.filePath}:${methodDef.line}`);
                    this.cache.remove(cachedMethod);
                    
                    // Update diagnostics for that file
                    const remainingUnused = this.cache.getForFile(methodDef.filePath);
                    if (remainingUnused.length === 0) {
                        this.diagnostics.clearFile(methodDef.filePath);
                    } else {
                        // Re-report remaining unused methods for this file
                        this.diagnostics.clearFile(methodDef.filePath);
                        for (const method of remainingUnused) {
                            this.diagnostics.reportUnusedMethod(method, config);
                        }
                    }
                    removedCount++;
                }
            }

            this.logger.debug(`Removed ${removedCount} now-used methods from cache`);
            this.logger.debug(`Analysis complete for new file: ${createdFilePath}`);
        } catch (error) {
            this.logger.error(`Error analyzing new file ${createdFilePath}: ${error}`);
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
            const declarationModifierBit = declarationModifierIndex >= 0 ? (1 << declarationModifierIndex) : 0;

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
                const isDeclaration = declarationModifierBit !== 0 && (tokenModifiers & declarationModifierBit) !== 0;

                // We want method calls (not declarations)
                if (isMethodLike && !isDeclaration) {
                    const position = new vscode.Position(line, character);

                    try {
                        const defs = await this.vscodeCommands.getDefinitions(document.uri, position);

                        if (defs && defs.length > 0) {
                            for (const def of defs) {
                                const { filePath: defPath, line: defLine } = this.vscodeCommands.extractDefinitionLocation(def);
                                
                                // Skip same file, external packages, and different packages
                                if (defPath === document.uri.fsPath) {
                                    continue;
                                }
                                
                                // Normalize path separators for consistent checks across platforms
                                const normalizedDefPath = defPath.split(path.sep).join('/');
                                if (normalizedDefPath.includes('.pub-cache') || normalizedDefPath.includes('/.dart_tool/')) {
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
