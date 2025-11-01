import * as assert from 'assert';
import * as vscode from 'vscode';
import { ReferenceAnalyzer } from '../../../core/referenceAnalyzer';
import { VscodeCommands } from '../../../infra/vscodeCommands';
import { MethodInfo } from '../../../shared/types';
import { createMockLogger } from '../../helpers/mockLogger';

suite('ReferenceAnalyzer Unit Tests', () => {
    let referenceAnalyzer: ReferenceAnalyzer;
    let mockVscodeCommands: VscodeCommands;
    let mockLogger: ReturnType<typeof createMockLogger>;

    setup(() => {
        mockLogger = createMockLogger();
        
        mockVscodeCommands = {
            getReferences: async () => []
        } as any;

        referenceAnalyzer = new ReferenceAnalyzer(mockVscodeCommands, mockLogger);
    });

    suite('Unused Method Detection', () => {
        test('should detect unused method with no references', async () => {
            const method: MethodInfo = {
                name: 'unusedMethod',
                filePath: '/test/file.dart',
                range: new vscode.Range(5, 2, 5, 14),
                isPrivate: false
            };

            mockVscodeCommands.getReferences = async () => [];

            const isUnused = await referenceAnalyzer.isMethodUnused(method, [], '/workspace');

            assert.strictEqual(isUnused, true, 'Should detect method with no references as unused');
        });

        test('should detect unused method with only definition reference', async () => {
            const method: MethodInfo = {
                name: 'unusedMethod',
                filePath: '/workspace/lib/file.dart',
                range: new vscode.Range(5, 2, 5, 14),
                isPrivate: false
            };

            const definitionLocation = new vscode.Location(
                vscode.Uri.file('/workspace/lib/file.dart'),
                new vscode.Range(5, 2, 5, 14)
            );

            mockVscodeCommands.getReferences = async () => [definitionLocation];

            const isUnused = await referenceAnalyzer.isMethodUnused(method, [], '/workspace');

            assert.strictEqual(isUnused, true, 'Should detect method with only definition as unused');
        });

        test('should detect used method with actual usage references', async () => {
            const method: MethodInfo = {
                name: 'usedMethod',
                filePath: '/workspace/lib/file.dart',
                range: new vscode.Range(5, 2, 5, 12),
                isPrivate: false
            };

            const references = [
                // Definition
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/file.dart'),
                    new vscode.Range(5, 2, 5, 12)
                ),
                // Actual usage
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/other.dart'),
                    new vscode.Range(10, 5, 10, 15)
                )
            ];

            mockVscodeCommands.getReferences = async () => references;

            const isUnused = await referenceAnalyzer.isMethodUnused(method, [], '/workspace');

            assert.strictEqual(isUnused, false, 'Should detect method with usage as used');
        });

        test('should detect used method with multiple usage references', async () => {
            const method: MethodInfo = {
                name: 'popularMethod',
                filePath: '/workspace/lib/file.dart',
                range: new vscode.Range(5, 2, 5, 15),
                isPrivate: false
            };

            const references = [
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/file.dart'),
                    new vscode.Range(5, 2, 5, 15)
                ),
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/usage1.dart'),
                    new vscode.Range(8, 5, 8, 18)
                ),
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/usage2.dart'),
                    new vscode.Range(12, 3, 12, 16)
                ),
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/usage3.dart'),
                    new vscode.Range(20, 10, 20, 23)
                )
            ];

            mockVscodeCommands.getReferences = async () => references;

            const isUnused = await referenceAnalyzer.isMethodUnused(method, [], '/workspace');

            assert.strictEqual(isUnused, false, 'Should detect method with multiple usages as used');
        });
    });

    suite('Exclusion Patterns', () => {
        test('should exclude references from generated files', async () => {
            const method: MethodInfo = {
                name: 'method',
                filePath: '/workspace/lib/file.dart',
                range: new vscode.Range(5, 2, 5, 8),
                isPrivate: false
            };

            const references = [
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/file.dart'),
                    new vscode.Range(5, 2, 5, 8)
                ),
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/generated.g.dart'),
                    new vscode.Range(10, 5, 10, 11)
                )
            ];

            mockVscodeCommands.getReferences = async () => references;

            const isUnused = await referenceAnalyzer.isMethodUnused(
                method,
                ['**/*.g.dart'],
                '/workspace'
            );

            assert.strictEqual(isUnused, true, 'Should exclude references from generated files');
        });

        test('should exclude references from test files', async () => {
            const method: MethodInfo = {
                name: 'method',
                filePath: '/workspace/lib/file.dart',
                range: new vscode.Range(5, 2, 5, 8),
                isPrivate: false
            };

            const references = [
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/file.dart'),
                    new vscode.Range(5, 2, 5, 8)
                ),
                new vscode.Location(
                    vscode.Uri.file('/workspace/test/file_test.dart'),
                    new vscode.Range(20, 5, 20, 11)
                )
            ];

            mockVscodeCommands.getReferences = async () => references;

            const isUnused = await referenceAnalyzer.isMethodUnused(
                method,
                ['**/test/**'],
                '/workspace'
            );

            assert.strictEqual(isUnused, true, 'Should exclude references from test files');
        });

        test('should handle multiple exclusion patterns', async () => {
            const method: MethodInfo = {
                name: 'method',
                filePath: '/workspace/lib/file.dart',
                range: new vscode.Range(5, 2, 5, 8),
                isPrivate: false
            };

            const references = [
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/file.dart'),
                    new vscode.Range(5, 2, 5, 8)
                ),
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/generated.g.dart'),
                    new vscode.Range(10, 5, 10, 11)
                ),
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/model.freezed.dart'),
                    new vscode.Range(15, 3, 15, 9)
                ),
                new vscode.Location(
                    vscode.Uri.file('/workspace/test/unit_test.dart'),
                    new vscode.Range(25, 8, 25, 14)
                )
            ];

            mockVscodeCommands.getReferences = async () => references;

            const isUnused = await referenceAnalyzer.isMethodUnused(
                method,
                ['**/*.g.dart', '**/*.freezed.dart', '**/test/**'],
                '/workspace'
            );

            assert.strictEqual(isUnused, true, 'Should apply all exclusion patterns');
        });

        test('should not exclude references from normal files', async () => {
            const method: MethodInfo = {
                name: 'method',
                filePath: '/workspace/lib/file.dart',
                range: new vscode.Range(5, 2, 5, 8),
                isPrivate: false
            };

            const references = [
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/file.dart'),
                    new vscode.Range(5, 2, 5, 8)
                ),
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/normal_file.dart'),
                    new vscode.Range(10, 5, 10, 11)
                )
            ];

            mockVscodeCommands.getReferences = async () => references;

            const isUnused = await referenceAnalyzer.isMethodUnused(
                method,
                ['**/*.g.dart'],
                '/workspace'
            );

            assert.strictEqual(isUnused, false, 'Should not exclude references from normal files');
        });
    });

    suite('Error Handling', () => {
        test('should treat method as used on error', async () => {
            const method: MethodInfo = {
                name: 'method',
                filePath: '/test/file.dart',
                range: new vscode.Range(5, 2, 5, 8),
                isPrivate: false
            };

            mockVscodeCommands.getReferences = async () => {
                throw new Error('Test error');
            };

            const isUnused = await referenceAnalyzer.isMethodUnused(method, [], '/workspace');

            assert.strictEqual(isUnused, false, 'Should fail-safe to used on error');
        });
    });

    suite('Class Methods', () => {
        test('should handle class methods', async () => {
            const method: MethodInfo = {
                name: 'myMethod',
                filePath: '/workspace/lib/file.dart',
                range: new vscode.Range(10, 2, 10, 10),
                isPrivate: false,
                className: 'MyClass'
            };

            mockVscodeCommands.getReferences = async () => [];

            const isUnused = await referenceAnalyzer.isMethodUnused(method, [], '/workspace');

            assert.strictEqual(isUnused, true, 'Should handle class methods');
        });

        test('should detect used class methods', async () => {
            const method: MethodInfo = {
                name: 'myMethod',
                filePath: '/workspace/lib/file.dart',
                range: new vscode.Range(10, 2, 10, 10),
                isPrivate: false,
                className: 'MyClass'
            };

            const references = [
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/file.dart'),
                    new vscode.Range(10, 2, 10, 10)
                ),
                new vscode.Location(
                    vscode.Uri.file('/workspace/lib/usage.dart'),
                    new vscode.Range(20, 10, 20, 18)
                )
            ];

            mockVscodeCommands.getReferences = async () => references;

            const isUnused = await referenceAnalyzer.isMethodUnused(method, [], '/workspace');

            assert.strictEqual(isUnused, false, 'Should detect used class methods');
        });
    });
});
