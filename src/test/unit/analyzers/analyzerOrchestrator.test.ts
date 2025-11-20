import * as assert from 'assert';
import * as vscode from 'vscode';
import { AnalyzerOrchestrator } from '../../../analyzers/analyzerOrchestrator';
import { WorkspaceAnalyzer } from '../../../core/workspaceAnalyzer';
import { IncrementalAnalysisHandler } from '../../../handlers/incrementalAnalysisHandler';
import { ConfigurationService } from '../../../services/configurationService';
import { Diagnostics } from '../../../infra/diagnostics';
import { createMockLogger } from '../../helpers/mockLogger';

suite('AnalyzerOrchestrator Unit Tests', () => {
    let orchestrator: AnalyzerOrchestrator;
    let mockWorkspaceAnalyzer: WorkspaceAnalyzer;
    let mockIncrementalHandler: IncrementalAnalysisHandler;
    let mockConfigService: ConfigurationService;
    let mockDiagnostics: Diagnostics;
    let mockLogger: ReturnType<typeof createMockLogger>;
    let mockCache: { getAll: () => any[] };
    let cachedMethods: any[];
    let currentConfig: any;

    setup(() => {
        mockLogger = createMockLogger();
        cachedMethods = [];
        mockCache = {
            getAll: () => cachedMethods
        };
        currentConfig = {
            enabled: true,
            sourceDirectory: 'lib',
            excludePatterns: [],
            severity: vscode.DiagnosticSeverity.Warning,
            maxConcurrency: 5,
            incrementalAnalysis: true,
            analysisDelay: 2000,
            unusedCodeReanalysisIntervalMinutes: 0
        };

        // Create minimal mocks
        mockWorkspaceAnalyzer = {
            analyze: async () => 0
        } as any;

        mockIncrementalHandler = {
            handleFileUpdated: async () => { },
            handleFileCreated: async () => { },
            handleFileDeleted: async () => { },
            reanalyzeFile: async () => { },
            reanalyzeCachedMethods: async () => { }
        } as any;

        mockConfigService = {
            getConfiguration: () => currentConfig,
            onDidChangeConfiguration: () => ({ dispose: () => { } } as vscode.Disposable)
        } as any;

        mockDiagnostics = {
            clear: () => { },
            clearFile: () => { },
            reportUnusedMethod: () => { },
            reportUnusedMethods: () => { },
            reportUnusedMethodsForFile: () => { }
        } as any;

        orchestrator = new AnalyzerOrchestrator(
            mockWorkspaceAnalyzer,
            mockIncrementalHandler,
            mockConfigService,
            mockDiagnostics,
            mockCache as any,
            mockLogger
        );
    });

    suite('Workspace Analysis', () => {
        test('should analyze workspace when enabled', async () => {
            let analyzeWorkspaceCalled = false;
            mockWorkspaceAnalyzer.analyze = async () => {
                analyzeWorkspaceCalled = true;
                return 5;
            };

            await orchestrator.analyzeWorkspace();

            assert.strictEqual(analyzeWorkspaceCalled, true, 'Should call workspace analyzer');
        });

        test('should not analyze when disabled', async () => {
            currentConfig = {
                enabled: false,
                sourceDirectory: 'lib',
                excludePatterns: [],
                severity: vscode.DiagnosticSeverity.Warning,
                maxConcurrency: 5,
                incrementalAnalysis: true,
                analysisDelay: 500,
                unusedCodeReanalysisIntervalMinutes: 0
            };

            let analyzeWorkspaceCalled = false;
            mockWorkspaceAnalyzer.analyze = async () => {
                analyzeWorkspaceCalled = true;
                return 0;
            };

            await orchestrator.analyzeWorkspace();

            assert.ok(analyzeWorkspaceCalled === false, 'Should not call workspace analyzer when disabled');
        });

        test('should queue workspace analysis requests and process sequentially', async () => {
            let analysisCount = 0;
            let running = 0;
            let maxConcurrent = 0;

            mockWorkspaceAnalyzer.analyze = async () => {
                analysisCount++;
                running++;
                maxConcurrent = Math.max(maxConcurrent, running);
                await new Promise(resolve => setTimeout(resolve, 50));
                running--;
                return 0;
            };

            const promise1 = orchestrator.analyzeWorkspace();
            const promise2 = orchestrator.analyzeWorkspace();

            await Promise.all([promise1, promise2]);

            assert.strictEqual(maxConcurrent, 1, 'Should not run workspace analyses in parallel');
            assert.strictEqual(analysisCount, 2, 'Should process each workspace analysis request');
        });

        test('should retry workspace analysis after failure', async () => {
            let attempts = 0;
            mockWorkspaceAnalyzer.analyze = async () => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('Temporary failure');
                }
                return 0;
            };

            orchestrator = new AnalyzerOrchestrator(
                mockWorkspaceAnalyzer,
                mockIncrementalHandler,
                mockConfigService,
                mockDiagnostics,
                mockCache as any,
                mockLogger,
                { defaultRetryAttempts: 2, defaultRetryDelayMs: 10 }
            );

            await orchestrator.analyzeWorkspace();

            assert.strictEqual(attempts, 2, 'Should retry once before succeeding');
        });

        test('should stop retrying workspace analysis after reaching limit', async () => {
            let attempts = 0;
            mockWorkspaceAnalyzer.analyze = async () => {
                attempts++;
                throw new Error('Persistent failure');
            };

            orchestrator = new AnalyzerOrchestrator(
                mockWorkspaceAnalyzer,
                mockIncrementalHandler,
                mockConfigService,
                mockDiagnostics,
                mockCache as any,
                mockLogger,
                { defaultRetryAttempts: 1, defaultRetryDelayMs: 10 }
            );

            await orchestrator.analyzeWorkspace();

            assert.strictEqual(attempts, 2, 'Should attempt initial run plus configured retries');
        });

        test('should handle analysis errors gracefully', async () => {
            mockWorkspaceAnalyzer.analyze = async () => {
                throw new Error('Test error');
            };

            // Should not throw
            await orchestrator.analyzeWorkspace();

            assert.ok(true, 'Should handle errors without throwing');
        });
    });

    suite('File Analysis', () => {
        test('should analyze file on save', async () => {
            const mockDocument = {
                uri: vscode.Uri.file('/test/file.dart'),
                getText: () => 'class Test {}'
            } as vscode.TextDocument;

            let handleFileUpdatedCalled = false;
            mockIncrementalHandler.handleFileUpdated = async () => {
                handleFileUpdatedCalled = true;
            };

            await orchestrator.analyzeFile(mockDocument);

            assert.strictEqual(handleFileUpdatedCalled, true, 'Should call incremental handler');
        });

        test('should respect incrementalAnalysis setting', async () => {
            currentConfig = {
                ...currentConfig,
                incrementalAnalysis: false
            };

            const mockDocument = {
                uri: vscode.Uri.file('/test/file.dart'),
                getText: () => ''
            } as vscode.TextDocument;

            let handleFileUpdatedCalled = false;
            mockIncrementalHandler.handleFileUpdated = async () => {
                handleFileUpdatedCalled = true;
            };

            await orchestrator.analyzeFile(mockDocument);

            assert.strictEqual(handleFileUpdatedCalled, false, 'Should skip analysis when incrementalAnalysis is disabled');
        });

        test('should skip excluded files', async () => {
            // Set up workspace folder for exclusion check
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                // Skip test if no workspace folder
                return;
            }

            currentConfig = {
                enabled: true,
                sourceDirectory: 'lib',
                excludePatterns: ['**/*.g.dart'],
                severity: vscode.DiagnosticSeverity.Warning,
                maxConcurrency: 5,
                incrementalAnalysis: true,
                analysisDelay: 500,
                unusedCodeReanalysisIntervalMinutes: 0
            };

            const mockDocument = {
                uri: vscode.Uri.file(workspaceFolders[0].uri.fsPath + '/test/file.g.dart'),
                getText: () => ''
            } as vscode.TextDocument;

            let handleFileUpdatedCalled = false;
            mockIncrementalHandler.handleFileUpdated = async () => {
                handleFileUpdatedCalled = true;
            };

            await orchestrator.analyzeFile(mockDocument);

            assert.strictEqual(handleFileUpdatedCalled, false, 'Should not analyze excluded files');
        });

        test('should queue file analyses and process sequentially', async () => {
            const mockDocument = {
                uri: vscode.Uri.file('/test/file.dart'),
                getText: () => ''
            } as vscode.TextDocument;

            let analysisCount = 0;
            let running = 0;
            let maxConcurrent = 0;

            mockIncrementalHandler.handleFileUpdated = async () => {
                analysisCount++;
                running++;
                maxConcurrent = Math.max(maxConcurrent, running);
                await new Promise(resolve => setTimeout(resolve, 25));
                running--;
            };

            // Start two analyses
            const promise1 = orchestrator.analyzeFile(mockDocument);
            const promise2 = orchestrator.analyzeFile(mockDocument);

            await Promise.all([promise1, promise2]);

            assert.strictEqual(maxConcurrent, 1, 'Should not run file analyses in parallel');
            assert.strictEqual(analysisCount, 2, 'Should process each file analysis request');
        });
    });

    suite('File Lifecycle Events', () => {
        test('should handle file creation', async () => {
            let handleFileCreatedCalled = false;
            mockIncrementalHandler.handleFileCreated = async () => {
                handleFileCreatedCalled = true;
            };

            await orchestrator.handleFileCreated('/test/new-file.dart');

            assert.strictEqual(handleFileCreatedCalled, true, 'Should handle file creation');
        });

        test('should handle file deletion', async () => {
            let handleFileDeletedCalled = false;
            mockIncrementalHandler.handleFileDeleted = async () => {
                handleFileDeletedCalled = true;
            };

            await orchestrator.handleFileDeleted('/test/deleted-file.dart');

            assert.strictEqual(handleFileDeletedCalled, true, 'Should handle file deletion');
        });

        test('should handle errors in file deletion', async () => {
            mockIncrementalHandler.handleFileDeleted = async () => {
                throw new Error('Deletion error');
            };

            // Should not throw
            await orchestrator.handleFileDeleted('/test/file.dart');

            assert.ok(true, 'Should handle deletion errors gracefully');
        });
    });

    suite('Unused Method Reanalysis', () => {
        test('should enqueue reanalysis for each cached file once', async () => {
            const fileA = '/test/a.dart';
            const fileB = '/test/b.dart';
            cachedMethods = [
                {
                    name: 'alpha',
                    filePath: fileA,
                    range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1)),
                    isPrivate: false
                },
                {
                    name: 'beta',
                    filePath: fileB,
                    range: new vscode.Range(new vscode.Position(1, 0), new vscode.Position(1, 1)),
                    isPrivate: false
                },
                {
                    name: 'gamma',
                    filePath: fileB,
                    range: new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 1)),
                    isPrivate: false
                }
            ];

            const reanalysisCalls: Array<{ filePath: string; methodNames: string[] }> = [];
            mockIncrementalHandler.reanalyzeCachedMethods = async (filePath: string, methods: any[]) => {
                reanalysisCalls.push({
                    filePath,
                    methodNames: methods.map((method: any) => method.name).sort()
                });
            };

            mockConfigService.getConfiguration = () => ({
                enabled: true,
                sourceDirectory: 'lib',
                excludePatterns: [],
                severity: vscode.DiagnosticSeverity.Warning,
                maxConcurrency: 5,
                incrementalAnalysis: true,
                analysisDelay: 2000,
                unusedCodeReanalysisIntervalMinutes: 1
            });

            await (orchestrator as any).enqueueUnusedMethodReanalysis();

            reanalysisCalls.sort((a, b) => a.filePath.localeCompare(b.filePath));
            assert.deepStrictEqual(reanalysisCalls, [
                { filePath: fileA, methodNames: ['alpha'] },
                { filePath: fileB, methodNames: ['beta', 'gamma'] }
            ], 'Should reanalyze cached methods per file once');
        });
    });

    suite('Configuration Changes', () => {
        test('should clear diagnostics when disabled via configuration change', () => {
            let clearCalled = 0;
            mockDiagnostics.clear = () => {
                clearCalled++;
            };

            currentConfig = {
                ...currentConfig,
                enabled: false
            };

            (orchestrator as any).handleConfigurationChange(currentConfig);

            assert.ok(clearCalled > 0, 'Should clear diagnostics when analyzer is disabled');
        });
    });

    suite('Dispose', () => {
        test('should dispose cleanly', () => {
            // Should not throw
            orchestrator.dispose();
            assert.ok(true, 'Should dispose without errors');
        });
    });
});
