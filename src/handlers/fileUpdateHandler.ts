import * as vscode from 'vscode';
import { CacheService, AnalysisMetrics } from '../services';
import { Diagnostics, Workspace } from '../infra';
import { DependencyTrackerService } from '../services/dependencyTrackerService';
import { MethodAnalyzer } from '../core/methodAnalyzer';
import { DependencyDiscovery } from '../core/dependencyDiscovery';
import { VscodeCommands } from '../infra/vscodeCommands';
import { FileSystemUtils } from '../shared/utils/fileSystemUtils';
import { Logger, MethodInfo, AnalyzerConfig } from '../shared/types';

/**
 * Handles file update (save) events with full incremental analysis.
 * Single Responsibility: Incrementally analyze modified files and their dependents.
 */
export class FileUpdateHandler {
    constructor(
        private readonly vscodeCommands: VscodeCommands,
        private readonly cache: CacheService,
        private readonly dependencyTracker: DependencyTrackerService,
        private readonly methodAnalyzer: MethodAnalyzer,
        private readonly dependencyDiscovery: DependencyDiscovery,
        private readonly diagnostics: Diagnostics,
        private readonly logger: Logger
    ) { }

    async handle(
        filePath: string,
        excludePatterns: string[],
        workspacePath: string,
        config: AnalyzerConfig,
        metrics?: AnalysisMetrics
    ): Promise<void> {
        // Check if file should be excluded (safety check)
        if (FileSystemUtils.shouldExclude(filePath, workspacePath, excludePatterns)) {
            return;
        }

        const startTime = Date.now();

        try {
            // Load and process the document
            const document = await Workspace.loadDocument(filePath);

            // Find file dependencies
            const currentReferences = await this.dependencyDiscovery.findFileDependencies(
                document,
                workspacePath
            );

            // Track removed references
            const removedReferences = this.dependencyTracker.findRemovedReferences(filePath, currentReferences);
            this.dependencyTracker.setDependencies(filePath, currentReferences);

            const allFilesToReanalyze = new Set([...currentReferences, ...removedReferences]);

            // Analyze the saved file
            const result = await this.methodAnalyzer.analyzeMethodsInFile(
                filePath,
                excludePatterns,
                workspacePath,
                config
            );
            this.cache.updateFile(filePath, result.unused);

            // Track metrics
            if (metrics) {
                metrics.filesAnalyzed = 1 + allFilesToReanalyze.size;
                metrics.methodsUnused = result.unused.length;
                metrics.methodsUsed = result.analyzed - result.unused.length;
            }

            // Re-analyze affected files
            for (const referencedFilePath of allFilesToReanalyze) {
                if (referencedFilePath === filePath) {
                    continue;
                }

                // Skip excluded files
                if (FileSystemUtils.shouldExclude(referencedFilePath, workspacePath, excludePatterns)) {
                    continue;
                }

                const referencedResult = await this.methodAnalyzer.analyzeMethodsInFile(
                    referencedFilePath,
                    excludePatterns,
                    workspacePath,
                    config
                );
                this.cache.updateFile(referencedFilePath, referencedResult.unused);

                if (metrics) {
                    metrics.methodsUnused += referencedResult.unused.length;
                    metrics.methodsUsed += referencedResult.analyzed - referencedResult.unused.length;
                }
            }

            const duration = Date.now() - startTime;
            this.logger.debug(` ${metrics?.filesAnalyzed || 0} files, ${metrics?.methodsUnused || 0} unused (${duration}ms)`);
        } catch (error) {
            this.logger.error(` ${error}`);
        }
    }

    async reanalyzeCachedMethods(
        filePath: string,
        methods: MethodInfo[],
        excludePatterns: string[],
        workspacePath: string,
        config: AnalyzerConfig,
        metrics?: AnalysisMetrics
    ): Promise<void> {
        if (FileSystemUtils.shouldExclude(filePath, workspacePath, excludePatterns)) {
            return;
        }

        const startTime = Date.now();

        try {
            const stillUnused = await this.methodAnalyzer.reanalyzeCachedMethods(
                filePath,
                methods,
                excludePatterns,
                workspacePath,
                config
            );

            this.cache.updateFile(filePath, stillUnused);

            if (metrics) {
                metrics.filesAnalyzed = 1;
                metrics.methodsUnused = stillUnused.length;
                metrics.methodsUsed = methods.length - stillUnused.length;
            }

            const duration = Date.now() - startTime;
            this.logger.debug(` Reanalyzed ${filePath}: ${stillUnused.length} unused (${duration}ms)`);
        } catch (error) {
            this.logger.error(` ${error}`);
            throw error;
        }
    }
}

