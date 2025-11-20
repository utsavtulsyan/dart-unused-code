import * as vscode from 'vscode';
import { MethodExtractor } from './methodExtractor';
import { ReferenceAnalyzer } from './referenceAnalyzer';
import { Diagnostics } from '../infra/diagnostics';
import { StatusBar, ProgressInfo } from '../infra/statusBar';
import { CacheService } from '../services/cacheService';
import { MetricsService } from '../services/metricsService';
import { DependencyTrackerService } from '../services/dependencyTrackerService';
import { DependencyDiscovery } from './dependencyDiscovery';
import { MethodInfo, Logger, AnalyzerConfig } from '../shared/types';
import { ParallelProcessor } from '../shared/utils/parallelProcessor';
import { FileSystemUtils } from '../shared/utils/fileSystemUtils';

/**
 * Handles workspace-wide analysis.
 * Single Responsibility: Orchestrates full workspace analysis.
 */
export class WorkspaceAnalyzer {
    constructor(
        private readonly methodExtractor: MethodExtractor,
        private readonly referenceAnalyzer: ReferenceAnalyzer,
        private readonly diagnostics: Diagnostics,
        private readonly cache: CacheService,
        private readonly metrics: MetricsService,
        private readonly dependencyTracker: DependencyTrackerService,
        private readonly dependencyDiscovery: DependencyDiscovery,
        private readonly logger: Logger
    ) { }

    async analyze(workspacePath: string, config: AnalyzerConfig): Promise<number> {
        const analysisMetrics = this.metrics.startAnalysis(false);

        try {
            this.logger.info(`Starting full workspace analysis`);

            // Clear previous results
            this.diagnostics.clear();

            // Discover Dart files
            StatusBar.showProgress('Discovering Dart files...');
            const dartFiles = await FileSystemUtils.findDartFiles(
                workspacePath,
                config.sourceDirectory,
                config.excludePatterns || [],
                this.logger
            );

            if (dartFiles.length === 0) {
                vscode.window.showInformationMessage('No Dart files found in source folder');
                return 0;
            }

            analysisMetrics.filesAnalyzed = dartFiles.length;
            this.logger.info(`Analyzing ${dartFiles.length} files`);

            // Load files into Analysis Server (with progress reporting)
            await this.loadFilesForAnalysis(dartFiles);

            // Build dependency map (with progress reporting)
            await this.buildDependencyMap(dartFiles, workspacePath, config.excludePatterns);

            // Extract and analyze methods
            const publicMethods = await this.extractPublicMethods(dartFiles, config.maxConcurrency);
            this.logger.debug(`Checking ${publicMethods.length} public methods`);

            const unusedMethods = await this.findUnusedMethods(
                publicMethods,
                config.excludePatterns,
                workspacePath,
                config.maxConcurrency,
                config
            );

            analysisMetrics.methodsUnused = unusedMethods.length;
            analysisMetrics.methodsUsed = publicMethods.length - unusedMethods.length;

            // Populate cache
            this.cache.populate(unusedMethods);

            this.logger.info(`Complete: ${unusedMethods.length} unused, ${analysisMetrics.methodsUsed} used`);
            return unusedMethods.length;
        } catch (error) {
            throw error;
        } finally {
            this.metrics.finishAnalysis(analysisMetrics);
            this.logger.debug(this.metrics.getPerformanceReport());
        }
    }

    private async loadFilesForAnalysis(dartFiles: string[]): Promise<void> {
        const batchSize = 50;
        const batches: string[][] = [];

        for (let i = 0; i < dartFiles.length; i += batchSize) {
            batches.push(dartFiles.slice(i, i + batchSize));
        }

        let filesLoaded = 0;
        for (const batch of batches) {
            const loadPromises = batch.map(async (filePath) => {
                try {
                    const uri = vscode.Uri.file(filePath);
                    await vscode.workspace.openTextDocument(uri);
                } catch (error) {
                    this.logger.warn(` Could not load ${filePath}: ${error}`);
                }
            });

            await Promise.all(loadPromises);
            filesLoaded += batch.length;

            // Report progress after each batch
            StatusBar.updateProgress({
                current: filesLoaded,
                total: dartFiles.length,
                phase: 'discovering',
                details: `${dartFiles.length} files`
            });
        }

        const waitTime = Math.min(5000, dartFiles.length * 10);
        this.logger.debug(`Waiting ${waitTime}ms for indexing to complete...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    private async buildDependencyMap(
        dartFiles: string[],
        workspacePath: string,
        excludePatterns: string[]
    ): Promise<void> {
        this.dependencyTracker.clear();
        const maxConcurrency = Math.min(5, dartFiles.length);

        await ParallelProcessor.processWithConcurrencyAndIndex(
            dartFiles,
            async (filePath: string) => {
                try {
                    const uri = vscode.Uri.file(filePath);
                    const document = await vscode.workspace.openTextDocument(uri);
                    const dependencies = await this.dependencyDiscovery.findFileDependencies(document, workspacePath);
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
                    details: 'Building dependencies'
                });
            }
        );
    }

    private async extractPublicMethods(dartFiles: string[], maxConcurrency: number): Promise<MethodInfo[]> {
        const concurrency = Math.min(maxConcurrency || 5, dartFiles.length);

        const allMethodArrays = await ParallelProcessor.processWithConcurrencyAndIndex(
            dartFiles,
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
                    details: `${dartFiles.length} files`
                });
            }
        );

        return allMethodArrays.flat();
    }

    private async findUnusedMethods(
        methods: MethodInfo[],
        excludePatterns: string[],
        workspacePath: string,
        maxConcurrency: number,
        config: AnalyzerConfig
    ): Promise<MethodInfo[]> {
        const concurrency = Math.min(maxConcurrency || 5, methods.length);

        const results = await ParallelProcessor.processWithConcurrencyAndIndex(
            methods,
            async (method: MethodInfo) => {
                const isUnused = await this.referenceAnalyzer.isMethodUnused(
                    method,
                    excludePatterns,
                    workspacePath
                );

                if (isUnused) {
                    this.diagnostics.reportUnusedMethod(method, config);
                    return method;
                }
                return null;
            },
            concurrency,
            (completed, total) => {
                StatusBar.updateProgress({
                    current: completed,
                    total,
                    phase: 'analyzing',
                    details: `${methods.length} methods`
                });
            }
        );

        return results.filter((method): method is MethodInfo => method !== null);
    }
}
