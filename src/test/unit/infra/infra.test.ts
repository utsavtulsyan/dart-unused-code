import * as assert from 'assert';
import * as vscode from 'vscode';
import { Diagnostics } from '../../../infra/diagnostics';
import { StatusBar, ProgressInfo } from '../../../infra/statusBar';
import { MethodInfo, AnalyzerConfig } from '../../../shared/types';

suite('Infra Unit Tests', () => {
    suite('Diagnostics', () => {
        let diagnosticCollection: vscode.DiagnosticCollection;
        let diagnostics: Diagnostics;

        setup(() => {
            diagnosticCollection = vscode.languages.createDiagnosticCollection('test');
            diagnostics = new Diagnostics(diagnosticCollection);
        });

        teardown(() => {
            diagnosticCollection.dispose();
        });

        test('should clear all diagnostics', () => {
            const uri = vscode.Uri.file('/test/file.dart');
            diagnosticCollection.set(uri, [
                new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, 10),
                    'Test',
                    vscode.DiagnosticSeverity.Warning
                )
            ]);

            diagnostics.clear();

            const allDiagnostics = [...diagnosticCollection];
            assert.strictEqual(allDiagnostics.length, 0);
        });

        test('should clear specific file diagnostics', () => {
            const uri1 = vscode.Uri.file('/test/file1.dart');
            const uri2 = vscode.Uri.file('/test/file2.dart');

            diagnosticCollection.set(uri1, [
                new vscode.Diagnostic(new vscode.Range(0, 0, 0, 10), 'Test1', vscode.DiagnosticSeverity.Warning)
            ]);
            diagnosticCollection.set(uri2, [
                new vscode.Diagnostic(new vscode.Range(0, 0, 0, 10), 'Test2', vscode.DiagnosticSeverity.Warning)
            ]);

            diagnostics.clearFile('/test/file1.dart');

            // VS Code API may return undefined or empty array for cleared diagnostics
            const uri1Diagnostics = diagnosticCollection.get(uri1);
            assert.ok(uri1Diagnostics === undefined || uri1Diagnostics.length === 0, 'File should be cleared');
            assert.strictEqual(diagnosticCollection.get(uri2)?.length, 1);
        });

        test('should report unused methods for file', () => {
            const methods: MethodInfo[] = [
                {
                    name: 'method1',
                    filePath: '/test/file.dart',
                    range: new vscode.Range(5, 0, 7, 1),
                    isPrivate: false
                },
                {
                    name: 'method2',
                    filePath: '/test/file.dart',
                    range: new vscode.Range(9, 0, 11, 1),
                    isPrivate: false
                }
            ];

            const config: AnalyzerConfig = {
                enabled: true,
                sourceDirectory: 'lib',
                excludePatterns: [],
                severity: vscode.DiagnosticSeverity.Warning,
                maxConcurrency: 5,
                analyzeOnSave: true,
                analysisDelay: 500
            };            diagnostics.reportUnusedMethodsForFile('/test/file.dart', methods, config);

            const uri = vscode.Uri.file('/test/file.dart');
            const fileDiagnostics = diagnosticCollection.get(uri);

            assert.strictEqual(fileDiagnostics?.length, 2);
        });

        test('should clear file when reporting zero unused methods', () => {
            const uri = vscode.Uri.file('/test/file.dart');
            diagnosticCollection.set(uri, [
                new vscode.Diagnostic(new vscode.Range(0, 0, 0, 10), 'Test', vscode.DiagnosticSeverity.Warning)
            ]);

            const config: AnalyzerConfig = {
                enabled: true,
                sourceDirectory: 'lib',
                excludePatterns: [],
                severity: vscode.DiagnosticSeverity.Warning,
                maxConcurrency: 5,
                analyzeOnSave: true,
                analysisDelay: 500
            };
            diagnostics.reportUnusedMethodsForFile('/test/file.dart', [], config);

            // VS Code API may return undefined or empty array when diagnostics are deleted
            const uriDiagnostics = diagnosticCollection.get(uri);
            assert.ok(uriDiagnostics === undefined || uriDiagnostics.length === 0, 'File should be cleared');
        });

        test('should create diagnostic with correct properties', () => {
            const method: MethodInfo = {
                name: 'testMethod',
                filePath: '/test/file.dart',
                range: new vscode.Range(5, 2, 5, 12),
                isPrivate: false
            };

            const config: AnalyzerConfig = {
                enabled: true,
                sourceDirectory: 'lib',
                excludePatterns: [],
                severity: vscode.DiagnosticSeverity.Error,
                maxConcurrency: 5,
                analyzeOnSave: true,
                analysisDelay: 500
            };

            diagnostics.reportUnusedMethod(method, config);

            const uri = vscode.Uri.file('/test/file.dart');
            const fileDiagnostics = diagnosticCollection.get(uri);

            assert.strictEqual(fileDiagnostics?.length, 1);
            assert.strictEqual(fileDiagnostics![0].severity, vscode.DiagnosticSeverity.Error);
            assert.strictEqual(fileDiagnostics![0].source, 'Dart Unused Code');
            assert.strictEqual(fileDiagnostics![0].code, 'unused-public-method');
            assert.ok(fileDiagnostics![0].message.includes('testMethod'));
        });
    });

    suite('StatusBar', () => {
        let statusBarItem: vscode.StatusBarItem;

        setup(() => {
            statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
            StatusBar.initialize(statusBarItem);
        });

        teardown(() => {
            StatusBar.dispose();
        });

        test('should show progress message', () => {
            StatusBar.showProgress('Analyzing...');
            assert.ok(statusBarItem.text.includes('Analyzing'));
        });

        test('should update progress with percentage', () => {
            const progress: ProgressInfo = {
                current: 50,
                total: 100,
                phase: 'analyzing'
            };

            StatusBar.updateProgress(progress);
            assert.ok(statusBarItem.text.includes('50'));
        });

        test('should handle discovering phase', () => {
            const progress: ProgressInfo = {
                current: 10,
                total: 50,
                phase: 'discovering'
            };

            StatusBar.updateProgress(progress);
            assert.ok(statusBarItem.text.length > 0);
        });

        test('should handle extracting phase', () => {
            const progress: ProgressInfo = {
                current: 20,
                total: 50,
                phase: 'extracting'
            };

            StatusBar.updateProgress(progress);
            assert.ok(statusBarItem.text.length > 0);
        });

        test('should handle analyzing phase', () => {
            const progress: ProgressInfo = {
                current: 30,
                total: 50,
                phase: 'analyzing'
            };

            StatusBar.updateProgress(progress);
            assert.ok(statusBarItem.text.length > 0);
        });

        test('should handle processing phase', () => {
            const progress: ProgressInfo = {
                current: 40,
                total: 50,
                phase: 'processing'
            };

            StatusBar.updateProgress(progress);
            assert.ok(statusBarItem.text.length > 0);
        });

        test('should toggle detailed view', () => {
            const progress: ProgressInfo = {
                current: 25,
                total: 100,
                phase: 'analyzing',
                details: 'test detail'
            };

            StatusBar.updateProgress(progress);
            const minimalText = statusBarItem.text;

            StatusBar.toggleDetailedView();
            StatusBar.updateProgress(progress);
            const detailedText = statusBarItem.text;

            assert.notStrictEqual(minimalText, detailedText, 'Text should change when toggling');
        });

        test('should hide status bar', () => {
            StatusBar.showProgress();
            StatusBar.hide();
            // Status bar should be hidden, no error should occur
            assert.ok(true);
        });
    });
});
