import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { DartPackageUtils } from '../../../../shared/utils/dartPackageUtils';

suite('DartPackageUtils Unit Tests', () => {
    let tempDir: string;
    let packageRoot1: string;
    let packageRoot2: string;

    setup(() => {
        // Create temporary test directories
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dart-test-'));
        packageRoot1 = path.join(tempDir, 'package1');
        packageRoot2 = path.join(tempDir, 'package2');

        fs.mkdirSync(packageRoot1, { recursive: true });
        fs.mkdirSync(packageRoot2, { recursive: true });
        fs.mkdirSync(path.join(packageRoot1, 'lib'), { recursive: true });
        fs.mkdirSync(path.join(packageRoot2, 'lib'), { recursive: true });

        // Create pubspec.yaml files
        fs.writeFileSync(path.join(packageRoot1, 'pubspec.yaml'), 'name: package1\n');
        fs.writeFileSync(path.join(packageRoot2, 'pubspec.yaml'), 'name: package2\n');
    });

    teardown(() => {
        // Clean up temporary directories
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    suite('Same Package Detection', () => {
        test('should return true for files in same package', () => {
            const file1 = path.join(packageRoot1, 'lib', 'file1.dart');
            const file2 = path.join(packageRoot1, 'lib', 'file2.dart');

            const result = DartPackageUtils.isInSamePackage(file1, file2);
            assert.strictEqual(result, true);
        });

        test('should return true for files in different subdirectories of same package', () => {
            const file1 = path.join(packageRoot1, 'lib', 'file1.dart');
            const file2 = path.join(packageRoot1, 'lib', 'src', 'file2.dart');

            const result = DartPackageUtils.isInSamePackage(file1, file2);
            assert.strictEqual(result, true);
        });

        test('should return false for files in different packages', () => {
            const file1 = path.join(packageRoot1, 'lib', 'file1.dart');
            const file2 = path.join(packageRoot2, 'lib', 'file2.dart');

            const result = DartPackageUtils.isInSamePackage(file1, file2);
            assert.strictEqual(result, false);
        });

        test('should return true for files at root and lib of same package', () => {
            const file1 = path.join(packageRoot1, 'main.dart');
            const file2 = path.join(packageRoot1, 'lib', 'file.dart');

            const result = DartPackageUtils.isInSamePackage(file1, file2);
            assert.strictEqual(result, true);
        });

        test('should return false for file with no pubspec', () => {
            const noPackageDir = path.join(tempDir, 'no-package');
            fs.mkdirSync(noPackageDir, { recursive: true });

            const file1 = path.join(noPackageDir, 'file1.dart');
            const file2 = path.join(packageRoot1, 'lib', 'file2.dart');

            const result = DartPackageUtils.isInSamePackage(file1, file2);
            assert.strictEqual(result, false);
        });

        test('should return false for both files with no pubspec', () => {
            const noPackageDir = path.join(tempDir, 'no-package');
            fs.mkdirSync(noPackageDir, { recursive: true });

            const file1 = path.join(noPackageDir, 'file1.dart');
            const file2 = path.join(noPackageDir, 'file2.dart');

            const result = DartPackageUtils.isInSamePackage(file1, file2);
            assert.strictEqual(result, false);
        });
    });

    suite('Nested Packages', () => {
        test('should handle nested packages correctly', () => {
            // Create nested package
            const nestedPackage = path.join(packageRoot1, 'nested');
            fs.mkdirSync(nestedPackage, { recursive: true });
            fs.writeFileSync(path.join(nestedPackage, 'pubspec.yaml'), 'name: nested\n');

            const fileInParent = path.join(packageRoot1, 'lib', 'file1.dart');
            const fileInNested = path.join(nestedPackage, 'file2.dart');

            const result = DartPackageUtils.isInSamePackage(fileInParent, fileInNested);
            assert.strictEqual(result, false);
        });

        test('should find nearest pubspec', () => {
            // Create nested package
            const nestedPackage = path.join(packageRoot1, 'nested');
            fs.mkdirSync(nestedPackage, { recursive: true });
            fs.writeFileSync(path.join(nestedPackage, 'pubspec.yaml'), 'name: nested\n');
            fs.mkdirSync(path.join(nestedPackage, 'lib'), { recursive: true });

            const file1 = path.join(nestedPackage, 'lib', 'file1.dart');
            const file2 = path.join(nestedPackage, 'lib', 'file2.dart');

            // Both should be in the nested package
            const result = DartPackageUtils.isInSamePackage(file1, file2);
            assert.strictEqual(result, true);
        });
    });

    suite('Edge Cases', () => {
        test('should handle same file', () => {
            const file = path.join(packageRoot1, 'lib', 'file.dart');
            const result = DartPackageUtils.isInSamePackage(file, file);
            assert.strictEqual(result, true);
        });

        test('should handle files with relative paths', () => {
            const file1 = path.join(packageRoot1, 'lib', 'file1.dart');
            const file2 = path.join(packageRoot1, 'lib', 'file2.dart');

            const result = DartPackageUtils.isInSamePackage(file1, file2);
            assert.strictEqual(result, true);
        });

        test('should handle deeply nested files', () => {
            const deepDir = path.join(packageRoot1, 'lib', 'src', 'deep', 'nested', 'folder');
            fs.mkdirSync(deepDir, { recursive: true });

            const file1 = path.join(packageRoot1, 'lib', 'file1.dart');
            const file2 = path.join(deepDir, 'file2.dart');

            const result = DartPackageUtils.isInSamePackage(file1, file2);
            assert.strictEqual(result, true);
        });
    });
});
