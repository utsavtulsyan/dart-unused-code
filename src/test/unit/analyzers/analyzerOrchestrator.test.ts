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

    setup(() => {
        mockLogger = createMockLogger();
        
        // Create minimal mocks
        mockWorkspaceAnalyzer = {
            analyze: async () => 0
        } as any;

        mockIncrementalHandler = {
            handleFileUpdated: async () => {},
            handleFileCreated: async () => {},
            handleFileDeleted: async () => {}
        } as any;

        mockConfigService = {
            getConfiguration: () => ({
                enabled: true,
                excludePatterns: [],
                severity: vscode.DiagnosticSeverity.Warning,
                maxConcurrency: 5,
                analyzeOnSave: true
            })
        } as any;

        mockDiagnostics = {
            clear: () => {},
            clearFile: () => {},
            reportUnusedMethod: () => {},
            reportUnusedMethods: () => {},
            reportUnusedMethodsForFile: () => {}
        } as any;

        orchestrator = new AnalyzerOrchestrator(
            mockWorkspaceAnalyzer,
            mockIncrementalHandler,
            mockConfigService,
            mockDiagnostics,
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
            mockConfigService.getConfiguration = () => ({
                enabled: false,
                sourceDirectory: 'lib',
                excludePatterns: [],
                severity: vscode.DiagnosticSeverity.Warning,
                maxConcurrency: 5,
                analyzeOnSave: true,
                analysisDelay: 500
            });

            let analyzeWorkspaceCalled = false;
            mockWorkspaceAnalyzer.analyze = async () => {
                analyzeWorkspaceCalled = true;
                return 0;
            };

            await orchestrator.analyzeWorkspace();
            
            assert.strictEqual(analyzeWorkspaceCalled, false, 'Should not call workspace analyzer when disabled');
        });

        test('should prevent concurrent workspace analysis', async () => {
            let analysisCount = 0;
            mockWorkspaceAnalyzer.analyze = async () => {
                analysisCount++;
                await new Promise(resolve => setTimeout(resolve, 100));
                return 0;
            };

            // Start two analyses concurrently
            const promise1 = orchestrator.analyzeWorkspace();
            const promise2 = orchestrator.analyzeWorkspace();

            await Promise.all([promise1, promise2]);
            
            assert.strictEqual(analysisCount, 1, 'Should only run one analysis at a time');
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

        test('should skip excluded files', async () => {
            // Set up workspace folder for exclusion check
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                // Skip test if no workspace folder
                return;
            }

            mockConfigService.getConfiguration = () => ({
                enabled: true,
                sourceDirectory: 'lib',
                excludePatterns: ['**/*.g.dart'],
                severity: vscode.DiagnosticSeverity.Warning,
                maxConcurrency: 5,
                analyzeOnSave: true,
                analysisDelay: 500
            });

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

        test('should prevent concurrent file analysis', async () => {
            const mockDocument = {
                uri: vscode.Uri.file('/test/file.dart'),
                getText: () => ''
            } as vscode.TextDocument;

            let analysisCount = 0;
            mockIncrementalHandler.handleFileUpdated = async () => {
                analysisCount++;
                await new Promise(resolve => setTimeout(resolve, 50));
            };

            // Start two analyses
            const promise1 = orchestrator.analyzeFile(mockDocument);
            const promise2 = orchestrator.analyzeFile(mockDocument);

            await Promise.all([promise1, promise2]);
            
            assert.strictEqual(analysisCount, 1, 'Should only run one file analysis at a time');
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

    suite('Dispose', () => {
        test('should dispose cleanly', () => {
            // Should not throw
            orchestrator.dispose();
            assert.ok(true, 'Should dispose without errors');
        });
    });
});
