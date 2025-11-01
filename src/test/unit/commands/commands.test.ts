import * as assert from 'assert';
import * as vscode from 'vscode';
import { AnalyzeWorkspaceCommand } from '../../../commands/analyzeWorkspaceCommand';
import { ClearDiagnosticsCommand } from '../../../commands/clearDiagnosticsCommand';
import { ToggleStatusBarDetailCommand } from '../../../commands/toggleStatusBarDetailCommand';
import { AnalyzerOrchestrator } from '../../../analyzers/analyzerOrchestrator';
import { Diagnostics } from '../../../infra/diagnostics';
import { StatusBar } from '../../../infra/statusBar';

suite('Command Handlers Unit Tests', () => {
    let diagnosticCollection: vscode.DiagnosticCollection;

    setup(() => {
        diagnosticCollection = vscode.languages.createDiagnosticCollection('test');
    });

    teardown(() => {
        diagnosticCollection.dispose();
    });

    suite('AnalyzeWorkspaceCommand', () => {
        test('should execute workspace analysis', async () => {
            let analyzeWorkspaceCalled = false;
            const mockOrchestrator = {
                analyzeWorkspace: async () => {
                    analyzeWorkspaceCalled = true;
                }
            } as any as AnalyzerOrchestrator;

            const command = new AnalyzeWorkspaceCommand(mockOrchestrator);
            await command.execute();

            assert.strictEqual(analyzeWorkspaceCalled, true, 'Should call orchestrator.analyzeWorkspace');
        });

        test('should register command', () => {
            const mockOrchestrator = {
                analyzeWorkspace: async () => {}
            } as any as AnalyzerOrchestrator;

            const command = new AnalyzeWorkspaceCommand(mockOrchestrator);
            const subscriptions: vscode.Disposable[] = [];
            const context: vscode.ExtensionContext = {
                subscriptions
            } as any;

            command.register(context);

            assert.strictEqual(subscriptions.length, 1, 'Should add to subscriptions');
            assert.ok(subscriptions[0].dispose, 'Subscription should have dispose method');
        });
    });

    suite('ClearDiagnosticsCommand', () => {
        test('should clear all diagnostics', () => {
            const diagnostics = new Diagnostics(diagnosticCollection);
            
            // Add some diagnostics
            const uri = vscode.Uri.file('/test/file.dart');
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 10),
                'Test diagnostic',
                vscode.DiagnosticSeverity.Warning
            );
            diagnosticCollection.set(uri, [diagnostic]);

            assert.strictEqual(diagnosticCollection.get(uri)?.length, 1, 'Should have diagnostics');

            const command = new ClearDiagnosticsCommand(diagnostics);
            command.execute();

            // Verify all diagnostics are cleared
            const allDiagnostics = [...diagnosticCollection];
            assert.strictEqual(allDiagnostics.length, 0, 'Should clear all diagnostics');
        });

        test('should register command', () => {
            const diagnostics = new Diagnostics(diagnosticCollection);
            const command = new ClearDiagnosticsCommand(diagnostics);
            
            const context: vscode.ExtensionContext = {
                subscriptions: []
            } as any;

            const disposable = command.register(context);

            assert.ok(disposable, 'Should return disposable');
            assert.strictEqual(context.subscriptions.length, 1, 'Should add to subscriptions');
        });
    });

    suite('ToggleStatusBarDetailCommand', () => {
        test('should toggle status bar detail view', () => {
            // Create a minimal status bar item for testing
            const statusBarItem = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Left,
                100
            );
            StatusBar.initialize(statusBarItem);

            const command = new ToggleStatusBarDetailCommand();
            
            // Execute toggle - this should not throw
            command.execute();
            assert.ok(true, 'Should toggle without errors');

            // Clean up
            statusBarItem.dispose();
        });
    });
});
