import * as path from 'path';
import * as fs from 'fs';

/**
 * Utility functions for Dart package operations.
 */
export class DartPackageUtils {
    /**
     * Checks if two files are in the same Dart package.
     * Two files are in the same package if they share the same package root.
     * 
     * @param file1 - Absolute path to first file
     * @param file2 - Absolute path to second file
     * @returns true if both files are in the same package
     */
    static isInSamePackage(file1: string, file2: string): boolean {
        const root1 = DartPackageUtils.findPackageRoot(file1);
        const root2 = DartPackageUtils.findPackageRoot(file2);
        return root1 !== null && root2 !== null && root1 === root2;
    }

    private static findPackageRoot(filePath: string): string | null {
        let currentDir = path.dirname(filePath);
        const root = path.parse(currentDir).root;

        while (currentDir !== root) {
            const pubspecPath = path.join(currentDir, 'pubspec.yaml');
            if (fs.existsSync(pubspecPath)) {
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }

        return null;
    }
}
