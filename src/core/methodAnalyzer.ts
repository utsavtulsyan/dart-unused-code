import { MethodExtractor } from './methodExtractor';
import { ReferenceAnalyzer } from './referenceAnalyzer';
import { Diagnostics } from '../infra/diagnostics';
import { MethodInfo, Logger, AnalyzerConfig } from '../shared/types';

/**
 * Core logic for analyzing methods in a file.
 * Separated from orchestration to avoid circular dependencies.
 */
export class MethodAnalyzer {
    constructor(
        private readonly methodExtractor: MethodExtractor,
        private readonly referenceAnalyzer: ReferenceAnalyzer,
        private readonly diagnostics: Diagnostics,
        private readonly logger: Logger
    ) { }

    /**
     * Analyzes all public methods in a file and reports unused ones.
     * Returns information about unused methods found.
     */
    async analyzeMethodsInFile(
        filePath: string,
        excludePatterns: string[],
        workspacePath: string,
        config: AnalyzerConfig
    ): Promise<{ analyzed: number; unused: MethodInfo[] }> {
        // Clear diagnostics for this file
        this.diagnostics.clearFile(filePath);

        // Extract all methods
        const methods = await this.methodExtractor.extractMethods(filePath);
        const publicMethods = methods.filter(m => !m.isPrivate);

        const unusedMethods: MethodInfo[] = [];

        // Analyze each method
        for (const method of publicMethods) {
            const isUnused = await this.referenceAnalyzer.isMethodUnused(
                method,
                excludePatterns,
                workspacePath
            );

            if (isUnused) {
                this.diagnostics.reportUnusedMethod(method, config);
                unusedMethods.push(method);
            }
        }

        return { analyzed: publicMethods.length, unused: unusedMethods };
    }

    /**
     * Revalidates cached unused methods for a file without re-extracting symbols.
     */
    async reanalyzeCachedMethods(
        filePath: string,
        methods: MethodInfo[],
        excludePatterns: string[],
        workspacePath: string,
        config: AnalyzerConfig
    ): Promise<MethodInfo[]> {
        this.diagnostics.clearFile(filePath);

        const stillUnused: MethodInfo[] = [];

        for (const method of methods) {
            const isUnused = await this.referenceAnalyzer.isMethodUnused(
                method,
                excludePatterns,
                workspacePath
            );

            if (isUnused) {
                this.diagnostics.reportUnusedMethod(method, config);
                stillUnused.push(method);
            }
        }

        return stillUnused;
    }
}
