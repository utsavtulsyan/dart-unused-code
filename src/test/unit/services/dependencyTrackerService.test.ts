import * as assert from 'assert';
import { DependencyTrackerService } from '../../../services/dependencyTrackerService';
import { createMockLogger } from '../../helpers/mockLogger';

suite('DependencyTrackerService Unit Tests', () => {
    let trackerService: DependencyTrackerService;
    let mockLogger: ReturnType<typeof createMockLogger>;

    setup(() => {
        mockLogger = createMockLogger();
        trackerService = new DependencyTrackerService(mockLogger);
    });

    teardown(() => {
        trackerService.clear();
    });

    suite('Basic Operations', () => {
        test('should set and get dependencies', () => {
            const filePath = '/path/to/file.dart';
            const dependencies = new Set(['/path/to/dep1.dart', '/path/to/dep2.dart']);

            trackerService.setDependencies(filePath, dependencies);
            const retrieved = trackerService.getDependencies(filePath);

            assert.strictEqual(retrieved.size, 2);
            assert.ok(retrieved.has('/path/to/dep1.dart'));
            assert.ok(retrieved.has('/path/to/dep2.dart'));
        });

        test('should return empty set for unknown file', () => {
            const dependencies = trackerService.getDependencies('/unknown/file.dart');
            assert.strictEqual(dependencies.size, 0);
        });

        test('should update dependencies', () => {
            const filePath = '/path/to/file.dart';
            const oldDeps = new Set(['/path/to/old.dart']);
            const newDeps = new Set(['/path/to/new.dart']);

            trackerService.setDependencies(filePath, oldDeps);
            trackerService.setDependencies(filePath, newDeps);

            const retrieved = trackerService.getDependencies(filePath);
            assert.strictEqual(retrieved.size, 1);
            assert.ok(!retrieved.has('/path/to/old.dart'));
            assert.ok(retrieved.has('/path/to/new.dart'));
        });
    });

    suite('Removed References Detection', () => {
        test('should detect removed references', () => {
            const filePath = '/path/to/file.dart';
            const oldDeps = new Set(['/path/to/dep1.dart', '/path/to/dep2.dart', '/path/to/dep3.dart']);
            const newDeps = new Set(['/path/to/dep1.dart', '/path/to/dep3.dart']);

            trackerService.setDependencies(filePath, oldDeps);
            const removed = trackerService.findRemovedReferences(filePath, newDeps);

            assert.strictEqual(removed.size, 1);
            assert.ok(removed.has('/path/to/dep2.dart'));
        });

        test('should return empty set when no references removed', () => {
            const filePath = '/path/to/file.dart';
            const oldDeps = new Set(['/path/to/dep1.dart']);
            const newDeps = new Set(['/path/to/dep1.dart', '/path/to/dep2.dart']);

            trackerService.setDependencies(filePath, oldDeps);
            const removed = trackerService.findRemovedReferences(filePath, newDeps);

            assert.strictEqual(removed.size, 0);
        });

        test('should return all references when all removed', () => {
            const filePath = '/path/to/file.dart';
            const oldDeps = new Set(['/path/to/dep1.dart', '/path/to/dep2.dart']);
            const newDeps = new Set<string>();

            trackerService.setDependencies(filePath, oldDeps);
            const removed = trackerService.findRemovedReferences(filePath, newDeps);

            assert.strictEqual(removed.size, 2);
        });

        test('should handle file with no previous dependencies', () => {
            const filePath = '/path/to/file.dart';
            const newDeps = new Set(['/path/to/dep1.dart']);

            const removed = trackerService.findRemovedReferences(filePath, newDeps);
            assert.strictEqual(removed.size, 0);
        });
    });

    suite('File Deletion', () => {
        test('should remove file and return its dependencies', () => {
            const deletedFile = '/path/to/deleted.dart';
            const dependencies = new Set(['/path/to/dep1.dart', '/path/to/dep2.dart']);

            trackerService.setDependencies(deletedFile, dependencies);
            const returned = trackerService.removeFile(deletedFile);

            assert.strictEqual(returned.size, 2);
            assert.ok(returned.has('/path/to/dep1.dart'));
            assert.strictEqual(trackerService.getDependencies(deletedFile).size, 0);
        });

        test('should clean up references to deleted file', () => {
            const deletedFile = '/path/to/deleted.dart';
            const file1 = '/path/to/file1.dart';
            const file2 = '/path/to/file2.dart';

            trackerService.setDependencies(file1, new Set([deletedFile, '/path/to/other.dart']));
            trackerService.setDependencies(file2, new Set([deletedFile]));

            trackerService.removeFile(deletedFile);

            const deps1 = trackerService.getDependencies(file1);
            const deps2 = trackerService.getDependencies(file2);

            assert.strictEqual(deps1.size, 1);
            assert.ok(!deps1.has(deletedFile));
            assert.strictEqual(deps2.size, 0);
        });

        test('should return empty set for unknown file', () => {
            const returned = trackerService.removeFile('/unknown/file.dart');
            assert.strictEqual(returned.size, 0);
        });
    });

    suite('Bulk Operations', () => {
        test('should clear all dependencies', () => {
            trackerService.setDependencies('/path/to/file1.dart', new Set(['/path/to/dep1.dart']));
            trackerService.setDependencies('/path/to/file2.dart', new Set(['/path/to/dep2.dart']));

            assert.strictEqual(trackerService.size(), 2);
            trackerService.clear();
            assert.strictEqual(trackerService.size(), 0);
        });

        test('should track size correctly', () => {
            assert.strictEqual(trackerService.size(), 0);

            trackerService.setDependencies('/path/to/file1.dart', new Set(['/dep1.dart']));
            assert.strictEqual(trackerService.size(), 1);

            trackerService.setDependencies('/path/to/file2.dart', new Set(['/dep2.dart']));
            assert.strictEqual(trackerService.size(), 2);

            trackerService.removeFile('/path/to/file1.dart');
            assert.strictEqual(trackerService.size(), 1);
        });
    });

    suite('Complex Scenarios', () => {
        test('should handle circular dependencies', () => {
            const file1 = '/path/to/file1.dart';
            const file2 = '/path/to/file2.dart';

            trackerService.setDependencies(file1, new Set([file2]));
            trackerService.setDependencies(file2, new Set([file1]));

            assert.ok(trackerService.getDependencies(file1).has(file2));
            assert.ok(trackerService.getDependencies(file2).has(file1));
        });

        test('should handle multiple files depending on same file', () => {
            const commonDep = '/path/to/common.dart';
            const file1 = '/path/to/file1.dart';
            const file2 = '/path/to/file2.dart';
            const file3 = '/path/to/file3.dart';

            trackerService.setDependencies(file1, new Set([commonDep]));
            trackerService.setDependencies(file2, new Set([commonDep]));
            trackerService.setDependencies(file3, new Set([commonDep]));

            trackerService.removeFile(file1);

            // Common dep should still be in other files
            assert.ok(trackerService.getDependencies(file2).has(commonDep));
            assert.ok(trackerService.getDependencies(file3).has(commonDep));
        });
    });
});
