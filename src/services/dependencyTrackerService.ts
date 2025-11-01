import * as vscode from 'vscode';

import { Logger } from '../shared/types';

/**
 * Service for tracking dependencies between files.
 * Keeps a map of: dependentFile -> Set<filesItImportsFrom>
 */
export class DependencyTrackerService {
    // Map<dependentFile, Set<fileItDependsOn>>
    private dependencies: Map<string, Set<string>> = new Map();

    constructor(
        private readonly logger: Logger
    ) {}

    /**
     * Updates dependencies for a file.
     */
    setDependencies(filePath: string, referencedFiles: Set<string>): void {
        this.dependencies.set(filePath, referencedFiles);
    }

    /**
     * Gets the files that a given file references.
     */
    getDependencies(filePath: string): Set<string> {
        return this.dependencies.get(filePath) || new Set<string>();
    }

    /**
     * Finds what files were removed from dependencies (for removed reference tracking).
     */
    findRemovedReferences(filePath: string, currentReferences: Set<string>): Set<string> {
        const previousReferences = this.dependencies.get(filePath) || new Set<string>();
        const removed = new Set<string>();
        
        for (const prevRef of previousReferences) {
            if (!currentReferences.has(prevRef)) {
                removed.add(prevRef);
            }
        }
        
        return removed;
    }

    /**
     * Cleans up dependency tracking for a deleted file.
     * Returns files that were referenced by the deleted file.
     */
    removeFile(deletedFilePath: string): Set<string> {
        this.logger.debug(` Removing file from dependency graph: ${deletedFilePath}`);
        
        // Get files that the deleted file referenced
        const filesReferencedByDeleted = this.dependencies.get(deletedFilePath) || new Set<string>();
        
        // Clean up dependency tracking for files that referenced the deleted file
        for (const [sourceFile, referencedFiles] of this.dependencies.entries()) {
            if (referencedFiles.has(deletedFilePath)) {
                referencedFiles.delete(deletedFilePath);
                this.logger.debug(` Cleaned up dependency: ${sourceFile} -> ${deletedFilePath}`);
            }
        }
        
        // Remove the deleted file from the dependency map
        this.dependencies.delete(deletedFilePath);
        
        return filesReferencedByDeleted;
    }

    /**
     * Clears all dependency tracking.
     */
    clear(): void {
        this.dependencies.clear();
    }

    /**
     * Gets the total number of tracked files.
     */
    size(): number {
        return this.dependencies.size;
    }
}
