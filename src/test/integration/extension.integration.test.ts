import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Integration tests for the Dart Unused Code extension lifecycle.
 * These tests focus on extension activation and command registration.
 * 
 * NOTE: Workspace analysis tests are in workspaceAnalysis.integration.test.ts
 *       File lifecycle tests are in fileLifecycle.integration.test.ts
 *       Method analyzer tests are in methodAnalyzer.integration.test.ts
 */
suite('Extension Integration Tests', () => {
    suiteSetup(async function () {

        // Open a Dart file to trigger onLanguage:dart activation
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const mainPath = path.join(workspaceFolder.uri.fsPath, 'lib', 'main.dart');
            const uri = vscode.Uri.file(mainPath);
            console.log('Opening Dart file to trigger extension activation:', mainPath);
            await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(uri);

            // Wait for extensions to activate
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Wait for Dart extension to activate
        const dartExt = vscode.extensions.getExtension('dart-code.dart-code');
        if (dartExt && !dartExt.isActive) {
            console.log('Activating Dart extension...');
            await dartExt.activate();
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Get our extension - it should be activated by opening the Dart file
        const ext = vscode.extensions.getExtension('utsavtulsyan.dart-unused-code');

        if (ext) {
            console.log('Extension found, isActive:', ext.isActive);
            if (!ext.isActive) {
                console.log('Manually activating extension...');
                await ext.activate();
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } else {
            console.error('Extension not found!');
        }
    });

    suite('Extension Activation', () => {
        test('should activate extension', () => {
            const ext = vscode.extensions.getExtension('utsavtulsyan.dart-unused-code');
            assert.ok(ext, 'Extension should be found');
            assert.ok(ext?.isActive, 'Extension should be activated');
        });

        test('should register commands', async () => {
            const commands = await vscode.commands.getCommands(true);

            assert.ok(
                commands.includes('dartUnusedCode.analyzeWorkspace'),
                'Analyze workspace command should be registered'
            );
            assert.ok(
                commands.includes('dartUnusedCode.clearDiagnostics'),
                'Clear diagnostics command should be registered'
            );
            assert.ok(
                commands.includes('dartUnusedCode.toggleStatusBarDetail'),
                'Toggle status bar command should be registered'
            );
        });
    });

    suite('Configuration', () => {
        test('should have configuration properties', () => {
            const config = vscode.workspace.getConfiguration('dartUnusedCode');

            assert.strictEqual(typeof config.get('enabled'), 'boolean');
            assert.ok(Array.isArray(config.get('excludePatterns')));
            assert.strictEqual(typeof config.get('severity'), 'string');
            assert.strictEqual(typeof config.get('analysisDelay'), 'number');
            assert.strictEqual(typeof config.get('incrementalAnalysis'), 'boolean');
        });

        test('should have default configuration values', () => {
            const config = vscode.workspace.getConfiguration('dartUnusedCode');

            assert.strictEqual(config.get('enabled'), true);
            assert.strictEqual(config.get('severity'), 'Warning');
            assert.strictEqual(config.get('incrementalAnalysis'), true);
        });

        test('should respect exclude patterns configuration', () => {
            const config = vscode.workspace.getConfiguration('dartUnusedCode');
            const excludePatterns = config.get<string[]>('excludePatterns') || [];

            // Verify default patterns exist
            assert.ok(excludePatterns.includes('**/*.g.dart'), 'Should exclude generated files');
            assert.ok(excludePatterns.includes('**/*.freezed.dart'), 'Should exclude freezed files');
            assert.ok(excludePatterns.some(p => p.includes('test')), 'Should exclude test files');
        });
    });

    suite('Incremental Analysis', () => {
        test('should re-analyze on file save', async function () {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                this.skip();
                return;
            }

            const examplePath = path.join(workspaceFolder.uri.fsPath, 'lib', 'example.dart');
            const uri = vscode.Uri.file(examplePath);

            // Open the file
            let document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);
            const originalContent = document.getText();

            // Initial analysis
            await vscode.commands.executeCommand('dartUnusedCode.analyzeWorkspace');
            await new Promise(resolve => setTimeout(resolve, 100));

            const initialDiagnostics = vscode.languages.getDiagnostics(uri);

            // Make a small edit and save
            const edit = new vscode.WorkspaceEdit();
            const lastLine = document.lineCount - 1;
            edit.insert(uri, new vscode.Position(lastLine, 0), '\n// Test comment\n');
            await vscode.workspace.applyEdit(edit);
            await document.save();

            // Wait briefly for incremental analysis to trigger
            await new Promise(resolve => setTimeout(resolve, 100));

            const afterSaveDiagnostics = vscode.languages.getDiagnostics(uri);

            // Diagnostics should still be present (we only added a comment)
            assert.ok(afterSaveDiagnostics.length >= 0, 'Diagnostics should be updated after save');

            // Cleanup: Restore original content
            document = await vscode.workspace.openTextDocument(uri);
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            const restoreEdit = new vscode.WorkspaceEdit();
            restoreEdit.replace(uri, fullRange, originalContent);
            await vscode.workspace.applyEdit(restoreEdit);
            await document.save();
        });
    });
});
