import * as vscode from 'vscode';
import {
    AnalysisTask,
    AnalysisOperation,
    AnalysisOperationType,
    AnalysisScopeType,
    MethodInfo,
    Logger,
    AnalyzerConfig,
} from '../shared/types';
import { MethodExtractor } from '../core/methodExtractor';
import { ReferenceAnalyzer } from '../core/referenceAnalyzer';
import { Diagnostics } from '../infra/diagnostics';
import { StatusBar } from '../infra/statusBar';
import { CacheService } from '../services/cacheService';
import { DependencyTrackerService } from '../services/dependencyTrackerService';
import { DependencyDiscovery } from '../core/dependencyDiscovery';
import { FileSystemUtils } from '../shared/utils/fileSystemUtils';
import { ParallelProcessor } from '../shared/utils/parallelProcessor';

/**
 * Executes composed analysis tasks by performing atomic operations.
 * Centralizes the execution logic for all analysis types.
 */
export class AnalysisExecutor {
    constructor(
        private readonly methodExtractor: MethodExtractor,
        private readonly referenceAnalyzer: ReferenceAnalyzer,
        private readonly diagnostics: Diagnostics,
        private readonly cache: CacheService,
        private readonly dependencyTracker: DependencyTrackerService,
        private readonly dependencyDiscovery: DependencyDiscovery,
        private readonly logger: Logger
    ) { }

    /**
     * Executes an analysis task by performing its operations in sequence.
     * 
     * @param task - The analysis task to execute
     * @param workspacePath - Workspace root path
     * @param config - Analyzer configuration
     * @returns Number of unused methods found
     */
    async executeTask(
        task: AnalysisTask,
        workspacePath: string,
        config: AnalyzerConfig
    ): Promise<number> {
        this.logger.info(`Executing task ${task.id} (${task.scope.type})`);

        // Resolve files based on scope
        const targetFiles = await this.resolveScope(task, workspacePath, config);

        if (targetFiles.length === 0) {
            this.logger.warn(`No files to analyze for task ${task.id}`);
            return 0;
        }

        this.logger.debug(`Resolved ${targetFiles.length} files for task ${task.id}`);

        // Execute operations in sequence, passing extracted methods between operations
        let extractedMethods: MethodInfo[] = [];

        for (const operation of task.operations) {
            const result = await this.executeOperation(
                operation,
                targetFiles,
                workspacePath,
                config,
                extractedMethods
            );

            // Store extracted methods for use in subsequent operations
            if (result) {
                extractedMethods = result;
            }
        }

        // Return count of unused methods (from cache)
        return this.cache.size;
    }

    /**
     * Resolves the scope to a concrete list of files.
     */
    private async resolveScope(
        task: AnalysisTask,
        workspacePath: string,
        config: AnalyzerConfig
    ): Promise<string[]> {
        const { scope } = task;

        switch (scope.type) {
            case AnalysisScopeType.WORKSPACE:
                return await this.getAllWorkspaceFiles(workspacePath, config);

            case AnalysisScopeType.FILES:
                return scope.files || [];

            case AnalysisScopeType.FILE_WITH_DEPENDENCIES:
                if (!scope.files || scope.files.length === 0) {
                    return [];
                }

                if (scope.includeDependencies) {
                    return this.getFilesWithDependencies(scope.files);
                }

                return scope.files;

            default:
                this.logger.warn(`Unknown scope type: ${scope.type}`);
                return [];
        }
    }

    /**
     * Gets all Dart files in the workspace.
     */
    private async getAllWorkspaceFiles(
        workspacePath: string,
        config: AnalyzerConfig
    ): Promise<string[]> {
        StatusBar.showProgress('Discovering Dart files...');

        const dartFiles = await FileSystemUtils.findDartFiles(
            workspacePath,
            config.sourceDirectory,
            config.excludePatterns || [],
            this.logger
        );

        this.logger.info(`Discovered ${dartFiles.length} Dart files`);
        return dartFiles;
    }

    /**
     * Gets files and their dependencies (or dependents).
     */
    private getFilesWithDependencies(files: string[]): string[] {
        const result = new Set<string>();

        for (const file of files) {
            // Add the file itself
            result.add(file);

            // Add dependencies (files this file imports)
            const dependencies = this.dependencyTracker.getDependencies(file);
            dependencies.forEach(dep => result.add(dep));
        }

        return Array.from(result);
    }

    /**
     * Executes a single atomic operation.
     * @returns Extracted methods if operation type is EXTRACT_METHODS, undefined otherwise
     */
    private async executeOperation(
        operation: AnalysisOperation,
        targetFiles: string[],
        workspacePath: string,
        config: AnalyzerConfig,
        extractedMethods: MethodInfo[]
    ): Promise<MethodInfo[] | undefined> {
        const operationFiles = operation.files.length > 0 ? operation.files : targetFiles;

        switch (operation.type) {
            case AnalysisOperationType.EXTRACT_METHODS:
                return await this.extractMethods(operationFiles, workspacePath, config);

            case AnalysisOperationType.CHECK_REFERENCES:
                await this.checkReferences(operationFiles, workspacePath, config, extractedMethods);
                return undefined;

            case AnalysisOperationType.CLEAR_CACHE:
                this.clearCache(operationFiles);
                return undefined;

            default:
                this.logger.warn(`Unknown operation type: ${operation.type}`);
                return undefined;
        }
    }

    /**
     * Extracts methods from files and updates the dependency map.
     * Returns the extracted public methods for downstream operations.
     */
    private async extractMethods(
        files: string[],
        workspacePath: string,
        config: AnalyzerConfig
    ): Promise<MethodInfo[]> {
        this.logger.debug(`Extracting methods from ${files.length} files`);
        StatusBar.showProgress(`Extracting methods from ${files.length} files...`);

        // Load files for analysis
        await this.loadFilesForAnalysis(files);

        // Build dependency map
        await this.buildDependencyMap(files, workspacePath, config.excludePatterns);

        // Extract public methods
        const concurrency = Math.min(config.maxConcurrency || 5, files.length);

        const allMethodArrays = await ParallelProcessor.processWithConcurrencyAndIndex(
            files,
            async (file: string) => {
                const methods = await this.methodExtractor.extractMethods(file);
                return methods.filter(m => !m.isPrivate);
            },
            concurrency,
            (completed, total) => {
                StatusBar.updateProgress({
                    current: completed,
                    total,
                    phase: 'extracting',
                    details: `${files.length} files`,
                });
            }
        );

        const publicMethods = allMethodArrays.flat();
        this.logger.debug(`Extracted ${publicMethods.length} public methods`);

        return publicMethods;
    }

    /**
     * Checks references for methods and reports diagnostics.
     * Uses extractedMethods if provided, otherwise falls back to cached methods.
     */
    private async checkReferences(
        files: string[],
        workspacePath: string,
        config: AnalyzerConfig,
        extractedMethods?: MethodInfo[]
    ): Promise<void> {
        // Get methods to check
        let methods: MethodInfo[];

        if (extractedMethods && extractedMethods.length > 0) {
            // Use freshly extracted methods
            methods = extractedMethods;
            this.logger.debug(`Checking references for ${methods.length} extracted methods`);
        } else if (files.length > 0) {
            // Get cached methods for specific files
            methods = this.cache.getForFiles(new Set(files));
            this.logger.debug(`Checking references for ${methods.length} cached methods from ${files.length} files`);
        } else {
            // Get all cached methods
            methods = this.cache.getAll();
            this.logger.debug(`Checking references for ${methods.length} cached methods (all files)`);
        }

        if (methods.length === 0) {
            this.logger.debug('No methods to check references for');
            return;
        }

        StatusBar.showProgress(`Checking ${methods.length} methods...`);

        const filesToCheck = new Set(methods.map(m => m.filePath));
        const concurrency = Math.min(config.maxConcurrency || 5, methods.length);

        // Timeout for individual method checks (10 seconds)
        // If Analysis Server doesn't respond within this time, treat method as used
        const methodCheckTimeout = 10000;

        const unusedMethods = await ParallelProcessor.processWithConcurrencyAndIndex(
            methods,
            async (method: MethodInfo) => {
                try {
                    // Wrap in timeout to prevent hanging
                    const isUnused = await Promise.race([
                        this.referenceAnalyzer.isMethodUnused(
                            method,
                            config.excludePatterns,
                            workspacePath
                        ),
                        new Promise<boolean>((_, reject) =>
                            setTimeout(() => reject(new Error('Method check timeout')), methodCheckTimeout)
                        )
                    ]);

                    if (isUnused) {
                        return method;
                    }
                    return null;
                } catch (error) {
                    this.logger.warn(
                        `Failed to check method ${method.name} at ${method.filePath}:${method.range.start.line}: ${error}`
                    );
                    // On error, assume method is used to be safe
                    return null;
                }
            },
            concurrency,
            (completed, total) => {
                StatusBar.updateProgress({
                    current: completed,
                    total,
                    phase: 'analyzing',
                    details: `${methods.length} methods`,
                });
            }
        );

        const filteredUnused = unusedMethods.filter((m): m is MethodInfo => m !== null);
        const unusedCount = filteredUnused.length;
        this.logger.debug(`Found ${unusedCount} unused methods`);

        // Group by file for cache and diagnostics updates
        const fileGroups = new Map<string, MethodInfo[]>();
        for (const method of filteredUnused) {
            const methods = fileGroups.get(method.filePath) || [];
            methods.push(method);
            fileGroups.set(method.filePath, methods);
        }

        // Update cache and diagnostics for each file (atomic replace)
        for (const [filePath, fileMethods] of fileGroups) {
            this.cache.updateFile(filePath, fileMethods);
            this.diagnostics.reportUnusedMethodsForFile(filePath, fileMethods, config);
        }

        // Clear cache and diagnostics for files that now have no unused methods
        for (const filePath of filesToCheck) {
            if (!fileGroups.has(filePath)) {
                this.cache.clearFile(filePath);
                this.diagnostics.clearFile(filePath);
            }
        }
    }

    /**
     * Clears cached data for specific files.
     */
    private clearCache(files: string[]): void {
        this.logger.debug(`Clearing cache for ${files.length} files`);

        for (const file of files) {
            this.cache.clearFile(file);
            this.diagnostics.clearFile(file);
            this.dependencyTracker.removeFile(file);
        }
    }

    /**
     * Loads files into the Analysis Server.
     */
    private async loadFilesForAnalysis(files: string[]): Promise<void> {
        const batchSize = 50;
        const batches: string[][] = [];

        for (let i = 0; i < files.length; i += batchSize) {
            batches.push(files.slice(i, i + batchSize));
        }

        let filesLoaded = 0;
        for (const batch of batches) {
            const loadPromises = batch.map(async (filePath) => {
                try {
                    const uri = vscode.Uri.file(filePath);
                    await vscode.workspace.openTextDocument(uri);
                } catch (error) {
                    this.logger.warn(`Could not load ${filePath}: ${error}`);
                }
            });

            await Promise.all(loadPromises);
            filesLoaded += batch.length;

            StatusBar.updateProgress({
                current: filesLoaded,
                total: files.length,
                phase: 'discovering',
                details: `${files.length} files`,
            });
        }

        const waitTime = Math.min(5000, files.length * 10);
        this.logger.debug(`Waiting ${waitTime}ms for indexing...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    /**
     * Builds dependency map for files.
     */
    private async buildDependencyMap(
        files: string[],
        workspacePath: string,
        excludePatterns: string[]
    ): Promise<void> {
        const maxConcurrency = Math.min(5, files.length);

        await ParallelProcessor.processWithConcurrencyAndIndex(
            files,
            async (filePath: string) => {
                try {
                    const uri = vscode.Uri.file(filePath);
                    const document = await vscode.workspace.openTextDocument(uri);
                    const dependencies = await this.dependencyDiscovery.findFileDependencies(
                        document,
                        workspacePath
                    );
                    const filteredDependencies = Array.from(dependencies).filter(depPath =>
                        !FileSystemUtils.shouldExclude(depPath, workspacePath, excludePatterns)
                    );
                    this.dependencyTracker.setDependencies(filePath, new Set(filteredDependencies));
                } catch (error) {
                    this.logger.error(`Error building dependencies for ${filePath}: ${error}`);
                }
            },
            maxConcurrency,
            (completed, total) => {
                StatusBar.updateProgress({
                    current: completed,
                    total,
                    phase: 'processing',
                    details: 'Building dependencies',
                });
            }
        );
    }
}
