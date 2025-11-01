import * as assert from 'assert';
import * as vscode from 'vscode';
import { MethodAnalyzer } from '../../../core/methodAnalyzer';
import { MethodExtractor } from '../../../core/methodExtractor';
import { ReferenceAnalyzer } from '../../../core/referenceAnalyzer';
import { Diagnostics } from '../../../infra/diagnostics';
import { MethodInfo } from '../../../shared/types';
import { createMockLogger } from '../../helpers/mockLogger';

suite('MethodAnalyzer Unit Tests', () => {
    let methodAnalyzer: MethodAnalyzer;
    let mockMethodExtractor: MethodExtractor;
    let mockReferenceAnalyzer: ReferenceAnalyzer;
    let mockDiagnostics: Diagnostics;
    let mockLogger: ReturnType<typeof createMockLogger>;

    setup(() => {
        mockLogger = createMockLogger();

        mockMethodExtractor = {
            extractMethods: async () => []
        } as any;

        mockReferenceAnalyzer = {
            isMethodUnused: async () => false
        } as any;

        mockDiagnostics = {
            clearFile: () => {},
            reportUnusedMethod: () => {}
        } as any;

        methodAnalyzer = new MethodAnalyzer(
            mockMethodExtractor,
            mockReferenceAnalyzer,
            mockDiagnostics,
            mockLogger
        );
    });

    suite('File Analysis', () => {
        test('should analyze file with no methods', async () => {
            mockMethodExtractor.extractMethods = async () => [];

            const result = await methodAnalyzer.analyzeMethodsInFile(
                '/test/file.dart',
                [],
                '/workspace',
                { severity: vscode.DiagnosticSeverity.Warning }
            );

            assert.strictEqual(result.analyzed, 0, 'Should analyze 0 methods');
            assert.strictEqual(result.unused.length, 0, 'Should find 0 unused methods');
        });

        test('should filter out private methods', async () => {
            const methods: MethodInfo[] = [
                {
                    name: 'publicMethod',
                    filePath: '/test/file.dart',
                    range: new vscode.Range(5, 0, 7, 1),
                    isPrivate: false
                },
                {
                    name: '_privateMethod',
                    filePath: '/test/file.dart',
                    range: new vscode.Range(9, 0, 11, 1),
                    isPrivate: true
                }
            ];

            mockMethodExtractor.extractMethods = async () => methods;
            mockReferenceAnalyzer.isMethodUnused = async () => true;

            const result = await methodAnalyzer.analyzeMethodsInFile(
                '/test/file.dart',
                [],
                '/workspace',
                { severity: vscode.DiagnosticSeverity.Warning }
            );

            assert.strictEqual(result.analyzed, 1, 'Should only analyze public methods');
            assert.strictEqual(result.unused.length, 1, 'Should only report public unused');
        });

        test('should detect unused methods', async () => {
            const methods: MethodInfo[] = [
                {
                    name: 'unusedMethod',
                    filePath: '/test/file.dart',
                    range: new vscode.Range(5, 0, 7, 1),
                    isPrivate: false
                }
            ];

            mockMethodExtractor.extractMethods = async () => methods;
            mockReferenceAnalyzer.isMethodUnused = async () => true;

            let diagnosticReported = false;
            mockDiagnostics.reportUnusedMethod = () => {
                diagnosticReported = true;
            };

            const result = await methodAnalyzer.analyzeMethodsInFile(
                '/test/file.dart',
                [],
                '/workspace',
                { severity: vscode.DiagnosticSeverity.Warning }
            );

            assert.strictEqual(result.analyzed, 1);
            assert.strictEqual(result.unused.length, 1);
            assert.strictEqual(diagnosticReported, true, 'Should report diagnostic');
        });

        test('should detect used methods', async () => {
            const methods: MethodInfo[] = [
                {
                    name: 'usedMethod',
                    filePath: '/test/file.dart',
                    range: new vscode.Range(5, 0, 7, 1),
                    isPrivate: false
                }
            ];

            mockMethodExtractor.extractMethods = async () => methods;
            mockReferenceAnalyzer.isMethodUnused = async () => false;

            const result = await methodAnalyzer.analyzeMethodsInFile(
                '/test/file.dart',
                [],
                '/workspace',
                { severity: vscode.DiagnosticSeverity.Warning }
            );

            assert.strictEqual(result.analyzed, 1);
            assert.strictEqual(result.unused.length, 0, 'Should not report used methods');
        });

        test('should handle mixed used and unused methods', async () => {
            const methods: MethodInfo[] = [
                {
                    name: 'usedMethod',
                    filePath: '/test/file.dart',
                    range: new vscode.Range(5, 0, 7, 1),
                    isPrivate: false
                },
                {
                    name: 'unusedMethod1',
                    filePath: '/test/file.dart',
                    range: new vscode.Range(9, 0, 11, 1),
                    isPrivate: false
                },
                {
                    name: 'unusedMethod2',
                    filePath: '/test/file.dart',
                    range: new vscode.Range(13, 0, 15, 1),
                    isPrivate: false
                }
            ];

            mockMethodExtractor.extractMethods = async () => methods;
            mockReferenceAnalyzer.isMethodUnused = async (method) => {
                return method.name !== 'usedMethod';
            };

            const result = await methodAnalyzer.analyzeMethodsInFile(
                '/test/file.dart',
                [],
                '/workspace',
                { severity: vscode.DiagnosticSeverity.Warning }
            );

            assert.strictEqual(result.analyzed, 3);
            assert.strictEqual(result.unused.length, 2);
            assert.ok(result.unused.some(m => m.name === 'unusedMethod1'));
            assert.ok(result.unused.some(m => m.name === 'unusedMethod2'));
        });

        test('should clear diagnostics before analysis', async () => {
            let clearFileCalled = false;
            mockDiagnostics.clearFile = () => {
                clearFileCalled = true;
            };

            mockMethodExtractor.extractMethods = async () => [];

            await methodAnalyzer.analyzeMethodsInFile(
                '/test/file.dart',
                [],
                '/workspace',
                { severity: vscode.DiagnosticSeverity.Warning }
            );

            assert.strictEqual(clearFileCalled, true, 'Should clear diagnostics before analysis');
        });

        test('should pass exclude patterns to reference analyzer', async () => {
            const methods: MethodInfo[] = [
                {
                    name: 'method',
                    filePath: '/test/file.dart',
                    range: new vscode.Range(5, 0, 7, 1),
                    isPrivate: false
                }
            ];

            const excludePatterns = ['**/*.g.dart', '**/test/**'];
            let capturedPatterns: string[] = [];

            mockMethodExtractor.extractMethods = async () => methods;
            mockReferenceAnalyzer.isMethodUnused = async (method, patterns) => {
                capturedPatterns = patterns;
                return true;
            };

            await methodAnalyzer.analyzeMethodsInFile(
                '/test/file.dart',
                excludePatterns,
                '/workspace',
                { severity: vscode.DiagnosticSeverity.Warning }
            );

            assert.deepStrictEqual(
                capturedPatterns,
                excludePatterns,
                'Should pass exclude patterns to reference analyzer'
            );
        });

        test('should pass workspace path to reference analyzer', async () => {
            const methods: MethodInfo[] = [
                {
                    name: 'method',
                    filePath: '/test/file.dart',
                    range: new vscode.Range(5, 0, 7, 1),
                    isPrivate: false
                }
            ];

            const workspacePath = '/my/workspace';
            let capturedWorkspace = '';

            mockMethodExtractor.extractMethods = async () => methods;
            mockReferenceAnalyzer.isMethodUnused = async (method, patterns, workspace) => {
                capturedWorkspace = workspace;
                return true;
            };

            await methodAnalyzer.analyzeMethodsInFile(
                '/test/file.dart',
                [],
                workspacePath,
                { severity: vscode.DiagnosticSeverity.Warning }
            );

            assert.strictEqual(
                capturedWorkspace,
                workspacePath,
                'Should pass workspace path to reference analyzer'
            );
        });
    });
});
