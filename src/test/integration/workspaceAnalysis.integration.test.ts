import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Comprehensive workspace analysis integration tests.
 * Tests the full analysis workflow with the real test-project workspace.
 * 
 * OPTIMIZATION: Analysis runs once in suiteSetup and all tests share the results
 * to avoid repeated expensive analysis operations.
 */
suite('Workspace Analysis Integration Tests', () => {
    let workspaceFolder: vscode.WorkspaceFolder;
    
    suiteSetup(async function() {
        this.timeout(30000);
        
        // Wait for extension to activate
        const ext = vscode.extensions.getExtension('utsavtulsyan.dart-unused-code');
        if (ext && !ext.isActive) {
            await ext.activate();
        }
        
        workspaceFolder = vscode.workspace.workspaceFolders?.[0]!;
        assert.ok(workspaceFolder, 'Workspace folder should be available');
        
        // Run analysis ONCE for all tests (diagnostics updated synchronously)
        await vscode.commands.executeCommand('dartUnusedCode.analyzeWorkspace');
    });

    test('should analyze workspace and detect unused methods', async function() {
        this.timeout(5000);
        
        // Get all diagnostics (analysis already done in suiteSetup)
        const allDiagnostics = vscode.languages.getDiagnostics();
        const unusedMethodDiagnostics = allDiagnostics
            .flatMap(([uri, diags]) => diags)
            .filter(d => d.source === 'Dart Unused Code');
        
        // Should find at least 2 unused methods (multiply and getFullDetails)
        assert.ok(
            unusedMethodDiagnostics.length >= 2, 
            `Should detect at least 2 unused methods, found ${unusedMethodDiagnostics.length}`
        );
    });

    test('should detect specific unused methods in example.dart', async function() {
        this.timeout(5000);
        
        const examplePath = path.join(workspaceFolder.uri.fsPath, 'lib', 'example.dart');
        const uri = vscode.Uri.file(examplePath);
        
        // Check diagnostics for example.dart (analysis already done in suiteSetup)
        const diagnostics = vscode.languages.getDiagnostics(uri);
        const unusedDiagnostics = diagnostics.filter(d => 
            d.source === 'Dart Unused Code' && d.message.includes('multiply')
        );
        
        assert.ok(
            unusedDiagnostics.length > 0, 
            'Should detect multiply method as unused in example.dart'
        );
    });

    test('should detect unused method in user.dart', async function() {
        this.timeout(5000);
        
        const userPath = path.join(workspaceFolder.uri.fsPath, 'lib', 'user.dart');
        const uri = vscode.Uri.file(userPath);
        
        // Check diagnostics for user.dart (analysis already done in suiteSetup)
        const diagnostics = vscode.languages.getDiagnostics(uri);
        const unusedDiagnostics = diagnostics.filter(d => 
            d.source === 'Dart Unused Code' && d.message.includes('getFullDetails')
        );
        
        assert.ok(
            unusedDiagnostics.length > 0, 
            'Should detect getFullDetails method as unused in user.dart'
        );
    });

    test('should NOT flag internally used methods', async function() {
        this.timeout(5000);
        
        const userPath = path.join(workspaceFolder.uri.fsPath, 'lib', 'user.dart');
        const uri = vscode.Uri.file(userPath);
        
        // Check that isAdult is NOT flagged (it's used internally by getStatus)
        const diagnostics = vscode.languages.getDiagnostics(uri);
        const isAdultDiagnostics = diagnostics.filter(d => 
            d.source === 'Dart Unused Code' && d.message.includes('isAdult')
        );
        
        assert.strictEqual(
            isAdultDiagnostics.length, 
            0, 
            'isAdult should NOT be flagged as unused (used internally by getStatus)'
        );
    });

    test('should respect configuration', async function() {
        this.timeout(10000);
        
        const config = vscode.workspace.getConfiguration('dartUnusedCode');
        
        // Verify default settings
        assert.strictEqual(config.get('enabled'), true, 'Should be enabled by default');
        assert.strictEqual(config.get('severity'), 'Warning', 'Should use Warning severity by default');
        assert.strictEqual(config.get('analyzeOnSave'), true, 'Should analyze on save by default');
        
        const excludePatterns = config.get<string[]>('excludePatterns') || [];
        assert.ok(excludePatterns.includes('**/*.g.dart'), 'Should exclude generated files');
    });

    test('should clear diagnostics', async function() {
        this.timeout(5000);
        
        // Verify we have diagnostics (from suiteSetup analysis)
        const allDiagnostics = vscode.languages.getDiagnostics();
        const beforeClear = allDiagnostics
            .flatMap(([uri, diags]) => diags)
            .filter(d => d.source === 'Dart Unused Code');
        
        assert.ok(beforeClear.length > 0, 'Should have diagnostics before clear');
        
        // Clear diagnostics (updated synchronously)
        await vscode.commands.executeCommand('dartUnusedCode.clearDiagnostics');
        
        // Verify diagnostics are cleared
        const afterClearDiagnostics = vscode.languages.getDiagnostics();
        const afterClear = afterClearDiagnostics
            .flatMap(([uri, diags]) => diags)
            .filter(d => d.source === 'Dart Unused Code');
        
        assert.strictEqual(afterClear.length, 0, 'Should have no diagnostics after clear');
    });
});
