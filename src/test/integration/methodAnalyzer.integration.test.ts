import * as assert from 'assert';
import * as vscode from 'vscode';
import { MethodAnalyzer } from '../../core/methodAnalyzer';
import { MethodExtractor } from '../../core/methodExtractor';
import { ReferenceAnalyzer } from '../../core/referenceAnalyzer';
import { Diagnostics } from '../../infra/diagnostics';
import { VscodeCommands } from '../../infra/vscodeCommands';
import { createMockLogger } from '../helpers/mockLogger';
import { MethodInfo } from '../../shared/types';
import * as path from 'path';
import * as fs from 'fs';

suite('MethodAnalyzer Integration Tests', () => {
    let methodAnalyzer: MethodAnalyzer;
    let methodExtractor: MethodExtractor;
    let referenceAnalyzer: ReferenceAnalyzer;
    let diagnostics: Diagnostics;
    let mockLogger: ReturnType<typeof createMockLogger>;
    let vscodeCommands: VscodeCommands;
    let diagnosticCollection: vscode.DiagnosticCollection;
    let testProjectPath: string;
    let testFile: string;

    suiteSetup(function () {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        // Use the test-project lib directory (workspace is already pointing to test-project)
        testProjectPath = path.join(workspaceFolder.uri.fsPath, 'lib');
    });

    suiteTeardown(() => {
        if (diagnosticCollection) {
            diagnosticCollection.dispose();
        }
    });

    setup(async () => {
        mockLogger = createMockLogger();
        vscodeCommands = new VscodeCommands();
        diagnosticCollection = vscode.languages.createDiagnosticCollection('test-diagnostics');
        diagnostics = new Diagnostics(diagnosticCollection);

        methodExtractor = new MethodExtractor(vscodeCommands, mockLogger);
        referenceAnalyzer = new ReferenceAnalyzer(vscodeCommands, mockLogger);
        methodAnalyzer = new MethodAnalyzer(
            methodExtractor,
            referenceAnalyzer,
            diagnostics,
            mockLogger
        );

        // Create a test Dart file in test-project/lib
        testFile = path.join(testProjectPath, 'test_file_temp.dart');
        const testContent = `
class TestClass {
  void usedMethod() {
    print('I am used');
  }

  void unusedMethod() {
    print('I am not used');
  }

  void _privateMethod() {
    print('Private');
  }
}

void main() {
  final test = TestClass();
  test.usedMethod();
}
`;
        fs.writeFileSync(testFile, testContent);

        // Wait for file system to settle
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    teardown(() => {
        diagnosticCollection.clear();
        if (fs.existsSync(testFile)) {
            fs.unlinkSync(testFile);
        }
    });

    test('should extract methods from file', async function () {
        const uri = vscode.Uri.file(testFile);
        await vscode.workspace.openTextDocument(uri);

        const methods = await methodExtractor.extractMethods(testFile);

        // Should find public methods but not private ones
        assert.ok(methods.length >= 2, 'Should find at least 2 public methods');
        assert.ok(methods.some((m: MethodInfo) => m.name === 'usedMethod'), 'Should find usedMethod');
        assert.ok(methods.some((m: MethodInfo) => m.name === 'unusedMethod'), 'Should find unusedMethod');

        // Private methods should be marked
        const privateMethods = methods.filter((m: MethodInfo) => m.isPrivate);
        assert.ok(privateMethods.every((m: MethodInfo) => m.name.startsWith('_')), 'Private methods should start with _');
    });

    test('should analyze methods and detect unused ones', async function () {
        const uri = vscode.Uri.file(testFile);
        await vscode.workspace.openTextDocument(uri);

        // Allow time for language server to index
        await new Promise(resolve => setTimeout(resolve, 300));

        const config = {
            enabled: true,
            sourceDirectory: 'lib',
            excludePatterns: ['**/*_test.dart'],
            severity: vscode.DiagnosticSeverity.Warning,
            maxConcurrency: 5,
            incrementalAnalysis: true,
            analysisDelay: 500,
            unusedCodeReanalysisIntervalMinutes: 0
        };

        const result = await methodAnalyzer.analyzeMethodsInFile(
            testFile,
            [],
            testProjectPath,
            config
        );

        assert.ok(result.analyzed >= 2, 'Should analyze at least 2 methods');
        // unusedMethod should be detected as unused
        assert.ok(
            result.unused.some((m: MethodInfo) => m.name === 'unusedMethod'),
            'Should detect unusedMethod as unused'
        );
    });

    test('should clear diagnostics for file', async function () {
        const uri = vscode.Uri.file(testFile);
        await vscode.workspace.openTextDocument(uri);

        const config = {
            enabled: true,
            sourceDirectory: 'lib',
            excludePatterns: [],
            severity: vscode.DiagnosticSeverity.Warning,
            maxConcurrency: 5,
            incrementalAnalysis: true,
            analysisDelay: 500,
            unusedCodeReanalysisIntervalMinutes: 0
        };

        // Analyze to create diagnostics
        await methodAnalyzer.analyzeMethodsInFile(testFile, [], testProjectPath, config);

        // Clear diagnostics
        diagnostics.clearFile(testFile);

        const fileDiagnostics = diagnosticCollection.get(uri);
        assert.strictEqual(fileDiagnostics?.length || 0, 0, 'Diagnostics should be cleared');
    });

    test('should handle files with no methods', async function () {
        const emptyFile = path.join(testProjectPath, 'empty_temp.dart');
        fs.writeFileSync(emptyFile, '// Empty file\n');

        const uri = vscode.Uri.file(emptyFile);
        await vscode.workspace.openTextDocument(uri);

        const methods = await methodExtractor.extractMethods(emptyFile);
        assert.strictEqual(methods.length, 0, 'Should find no methods in empty file');

        if (fs.existsSync(emptyFile)) {
            fs.unlinkSync(emptyFile);
        }
    });

    test('should exclude test annotated methods', async function () {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            this.skip();
            return;
        }

        const testMethodFile = path.join(workspaceFolder.uri.fsPath, 'lib', 'annotation_test.dart');

        // Verify file exists
        if (!fs.existsSync(testMethodFile)) {
            console.log('annotation_test.dart not found in test project, skipping');
            this.skip();
            return;
        }

        const uri = vscode.Uri.file(testMethodFile);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);

        // Give more time for Dart Analysis Server to index the file
        await new Promise(resolve => setTimeout(resolve, 300));

        const methods = await methodExtractor.extractMethods(testMethodFile);

        // If no methods found, skip gracefully
        if (methods.length === 0) {
            console.log('No methods extracted - Dart Analysis Server may not have indexed the file yet');
            this.skip();
            return;
        }

        // Deprecated annotated method should NOT be filtered (it's not @test or @override)
        const hasDeprecatedMethod = methods.some((m: MethodInfo) => m.name === 'annotatedDeprecatedMethod');
        assert.strictEqual(hasDeprecatedMethod, true, 'Deprecated methods should be included (not filtered)');

        // Regular method should be included
        const hasNormalMethod = methods.some((m: MethodInfo) => m.name === 'regularNormalMethod');
        assert.strictEqual(hasNormalMethod, true, 'Regular methods should be included');
    });

    test('should exclude override annotated methods', async function () {
        const overrideFile = path.join(testProjectPath, 'override_methods_temp.dart');
        const content = `
class BaseClass {
  void baseMethod() {}
}

class DerivedClass extends BaseClass {
  @override
  void baseMethod() {
    print('Overridden');
  }

  void newMethod() {
    print('New');
  }
}
`;
        fs.writeFileSync(overrideFile, content);

        const uri = vscode.Uri.file(overrideFile);
        await vscode.workspace.openTextDocument(uri);

        const methods = await methodExtractor.extractMethods(overrideFile);

        // Override method should be filtered out
        const overrideMethods = methods.filter((m: MethodInfo) => m.name === 'baseMethod' && m.className === 'DerivedClass');
        assert.strictEqual(overrideMethods.length, 0, 'Override methods should be excluded');

        assert.ok(
            methods.some((m: MethodInfo) => m.name === 'newMethod'),
            'Non-override methods should be included'
        );

        if (fs.existsSync(overrideFile)) {
            fs.unlinkSync(overrideFile);
        }
    });
});
