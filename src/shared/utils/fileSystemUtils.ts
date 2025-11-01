import * as path from 'path';
import * as fs from 'fs';
import { minimatch } from 'minimatch';
import { Logger } from '../types';

/**
 * Utilities for file system operations.
 */
export class FileSystemUtils {
    /**
     * Finds all Dart files in the lib/ directory, respecting exclude patterns.
     */
    static findDartFiles(
        rootPath: string, 
        excludePatterns: string[],
        logger: Logger
    ): string[] {
        const libPath = path.join(rootPath, 'lib');
        
        if (!fs.existsSync(libPath)) {
            logger.warn('[FILE_DISCOVERY] lib/ directory not found');
            return [];
        }

        const files: string[] = [];
        this.walkDirectory(libPath, rootPath, excludePatterns, files);

        logger.info(`[FILE_DISCOVERY] Found ${files.length} Dart files`);
        return files;
    }

    /**
     * Recursively walks a directory and collects Dart files.
     */
    private static walkDirectory(
        dir: string, 
        rootPath: string, 
        excludePatterns: string[], 
        files: string[]
    ): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (this.shouldExclude(fullPath, rootPath, excludePatterns)) {
                continue;
            }

            if (entry.isDirectory()) {
                this.walkDirectory(fullPath, rootPath, excludePatterns, files);
            } else if (entry.name.endsWith('.dart')) {
                files.push(fullPath);
            }
        }
    }

    /**
     * Checks if a file path should be excluded based on patterns.
     */
    static shouldExclude(filePath: string, rootPath: string, patterns: string[]): boolean {
        const relativePath = path.relative(rootPath, filePath);
        return patterns.some(pattern => minimatch(relativePath, pattern));
    }


}
