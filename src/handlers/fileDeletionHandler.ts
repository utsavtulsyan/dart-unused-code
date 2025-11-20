import * as fs from 'fs';
import { CacheService } from '../services/cacheService';
import { DependencyTrackerService } from '../services/dependencyTrackerService';
import { FileSystemUtils } from '../shared/utils/fileSystemUtils';
import { MethodAnalyzer } from '../core/methodAnalyzer';
import { Logger, AnalyzerConfig } from '../shared/types';

/**
 * Handles file deletion events.
 * Single Responsibility: Clean up state and re-analyze affected files.
 */
export class FileDeletionHandler {
    constructor(
        private readonly cache: CacheService,
        private readonly methodAnalyzer: MethodAnalyzer,
        private readonly dependencyTracker: DependencyTrackerService,
        private readonly logger: Logger
    ) { }

    async handle(
        deletedFilePath: string,
        excludePatterns: string[],
        workspacePath: string,
        config: AnalyzerConfig
    ): Promise<void> {
        this.logger.debug(`File deleted: ${deletedFilePath}`);

        try {
            // Step 1: Get files that were referenced by the deleted file and clean up dependency graph
            const filesReferencedByDeleted = this.dependencyTracker.removeFile(deletedFilePath);
            this.logger.debug(`Deleted file referenced ${filesReferencedByDeleted.size} files`);

            // Step 2: Remove deleted file from cache
            this.cache.clearFile(deletedFilePath);

            // Step 3: Filter out excluded files and non-existent files
            const filesToReanalyze = new Set<string>();

            for (const referencedFile of filesReferencedByDeleted) {
                // Skip excluded files
                if (FileSystemUtils.shouldExclude(referencedFile, workspacePath, excludePatterns)) {
                    this.logger.debug(`Skipping excluded file: ${referencedFile}`);
                    continue;
                }

                // Skip non-existent files
                if (!fs.existsSync(referencedFile)) {
                    this.logger.debug(`File no longer exists: ${referencedFile}`);
                    continue;
                }

                filesToReanalyze.add(referencedFile);
            }

            this.logger.debug(`Re-analyzing ${filesToReanalyze.size} files affected by deletion`);

            // Step 4: Re-analyze each affected file
            for (const fileToReanalyze of filesToReanalyze) {
                this.logger.debug(`Re-analyzing: ${fileToReanalyze}`);

                const result = await this.methodAnalyzer.analyzeMethodsInFile(
                    fileToReanalyze,
                    excludePatterns,
                    workspacePath,
                    config
                );
                this.cache.updateFile(fileToReanalyze, result.unused);
            }

            this.logger.debug(`Deletion handling complete for ${deletedFilePath}`);
        } catch (error) {
            this.logger.error(`Error handling file deletion: ${error}`);
        }
    }
}
