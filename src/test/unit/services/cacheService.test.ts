import * as assert from 'assert';
import * as vscode from 'vscode';
import { CacheService } from '../../../services/cacheService';
import { MethodInfo } from '../../../shared/types';
import { createMockLogger } from '../../helpers/mockLogger';

suite('CacheService Unit Tests', () => {
    let cacheService: CacheService;
    let mockLogger: ReturnType<typeof createMockLogger>;

    const createMethodInfo = (name: string, filePath: string, line: number): MethodInfo => ({
        name,
        filePath,
        range: new vscode.Range(line, 0, line, 10),
        isPrivate: false,
        className: 'TestClass'
    });

    setup(() => {
        mockLogger = createMockLogger();
        cacheService = new CacheService(mockLogger);
    });

    teardown(() => {
        cacheService.clear();
    });

    suite('Basic Operations', () => {
        test('should add and retrieve method', () => {
            const method = createMethodInfo('testMethod', '/path/to/file.dart', 10);
            cacheService.add(method);

            const retrieved = cacheService.get('/path/to/file.dart', 10);
            assert.strictEqual(retrieved?.name, 'testMethod');
            assert.strictEqual(cacheService.size, 1);
        });

        test('should check if method exists', () => {
            const method = createMethodInfo('testMethod', '/path/to/file.dart', 10);
            assert.strictEqual(cacheService.has(method), false);

            cacheService.add(method);
            assert.strictEqual(cacheService.has(method), true);
        });

        test('should remove method', () => {
            const method = createMethodInfo('testMethod', '/path/to/file.dart', 10);
            cacheService.add(method);
            assert.strictEqual(cacheService.size, 1);

            cacheService.remove(method);
            assert.strictEqual(cacheService.size, 0);
            assert.strictEqual(cacheService.has(method), false);
        });

        test('should return undefined for non-existent method', () => {
            const retrieved = cacheService.get('/path/to/file.dart', 10);
            assert.strictEqual(retrieved, undefined);
        });
    });

    suite('File Operations', () => {
        test('should get all methods for a file', () => {
            const method1 = createMethodInfo('method1', '/path/to/file.dart', 10);
            const method2 = createMethodInfo('method2', '/path/to/file.dart', 20);
            const method3 = createMethodInfo('method3', '/path/to/other.dart', 30);

            cacheService.add(method1);
            cacheService.add(method2);
            cacheService.add(method3);

            const methods = cacheService.getForFile('/path/to/file.dart');
            assert.strictEqual(methods.length, 2);
            assert.ok(methods.some(m => m.name === 'method1'));
            assert.ok(methods.some(m => m.name === 'method2'));
        });

        test('should get methods for multiple files', () => {
            const method1 = createMethodInfo('method1', '/path/to/file1.dart', 10);
            const method2 = createMethodInfo('method2', '/path/to/file2.dart', 20);
            const method3 = createMethodInfo('method3', '/path/to/file3.dart', 30);

            cacheService.add(method1);
            cacheService.add(method2);
            cacheService.add(method3);

            const filePaths = new Set(['/path/to/file1.dart', '/path/to/file2.dart']);
            const methods = cacheService.getForFiles(filePaths);
            assert.strictEqual(methods.length, 2);
            assert.ok(methods.some(m => m.name === 'method1'));
            assert.ok(methods.some(m => m.name === 'method2'));
            assert.ok(!methods.some(m => m.name === 'method3'));
        });

        test('should update file with new methods', () => {
            const oldMethod = createMethodInfo('oldMethod', '/path/to/file.dart', 10);
            cacheService.add(oldMethod);

            const newMethod1 = createMethodInfo('newMethod1', '/path/to/file.dart', 20);
            const newMethod2 = createMethodInfo('newMethod2', '/path/to/file.dart', 30);
            cacheService.updateFile('/path/to/file.dart', [newMethod1, newMethod2]);

            const methods = cacheService.getForFile('/path/to/file.dart');
            assert.strictEqual(methods.length, 2);
            assert.ok(!methods.some(m => m.name === 'oldMethod'));
            assert.ok(methods.some(m => m.name === 'newMethod1'));
        });

        test('should clear file', () => {
            const method1 = createMethodInfo('method1', '/path/to/file.dart', 10);
            const method2 = createMethodInfo('method2', '/path/to/file.dart', 20);
            const method3 = createMethodInfo('method3', '/path/to/other.dart', 30);

            cacheService.add(method1);
            cacheService.add(method2);
            cacheService.add(method3);

            cacheService.clearFile('/path/to/file.dart');
            assert.strictEqual(cacheService.getForFile('/path/to/file.dart').length, 0);
            assert.strictEqual(cacheService.getForFile('/path/to/other.dart').length, 1);
        });
    });

    suite('Bulk Operations', () => {
        test('should populate cache', () => {
            const methods = [
                createMethodInfo('method1', '/path/to/file1.dart', 10),
                createMethodInfo('method2', '/path/to/file2.dart', 20),
                createMethodInfo('method3', '/path/to/file3.dart', 30)
            ];

            cacheService.populate(methods);
            assert.strictEqual(cacheService.size, 3);
        });

        test('should clear all methods', () => {
            const methods = [
                createMethodInfo('method1', '/path/to/file1.dart', 10),
                createMethodInfo('method2', '/path/to/file2.dart', 20)
            ];

            cacheService.populate(methods);
            assert.strictEqual(cacheService.size, 2);

            cacheService.clear();
            assert.strictEqual(cacheService.size, 0);
        });

        test('should get all methods', () => {
            const methods = [
                createMethodInfo('method1', '/path/to/file1.dart', 10),
                createMethodInfo('method2', '/path/to/file2.dart', 20)
            ];

            cacheService.populate(methods);
            const allMethods = cacheService.getAll();
            assert.strictEqual(allMethods.length, 2);
        });
    });

    suite('Edge Cases', () => {
        test('should handle methods with same name but different lines', () => {
            const method1 = createMethodInfo('testMethod', '/path/to/file.dart', 10);
            const method2 = createMethodInfo('testMethod', '/path/to/file.dart', 20);

            cacheService.add(method1);
            cacheService.add(method2);

            assert.strictEqual(cacheService.size, 2);
            assert.strictEqual(cacheService.get('/path/to/file.dart', 10)?.name, 'testMethod');
            assert.strictEqual(cacheService.get('/path/to/file.dart', 20)?.name, 'testMethod');
        });

        test('should handle empty file path set', () => {
            const methods = cacheService.getForFiles(new Set());
            assert.strictEqual(methods.length, 0);
        });

        test('should handle empty update', () => {
            const method = createMethodInfo('method', '/path/to/file.dart', 10);
            cacheService.add(method);

            cacheService.updateFile('/path/to/file.dart', []);
            assert.strictEqual(cacheService.getForFile('/path/to/file.dart').length, 0);
        });
    });
});
