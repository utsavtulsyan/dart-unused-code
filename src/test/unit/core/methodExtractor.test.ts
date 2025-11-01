import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MethodExtractor } from '../../../core/methodExtractor';
import { VscodeCommands } from '../../../infra/vscodeCommands';
import { createMockLogger } from '../../helpers/mockLogger';

suite('MethodExtractor Unit Tests', () => {
    let methodExtractor: MethodExtractor;
    let mockVscodeCommands: VscodeCommands;
    let mockLogger: ReturnType<typeof createMockLogger>;
    let testFilePath: string;
    let tempDir: string;

    setup(() => {
        mockLogger = createMockLogger();
        
        // Create a temporary directory and file for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dart-test-'));
        testFilePath = path.join(tempDir, 'test.dart');
        
        // Write a minimal Dart file that can be opened by VS Code
        // Line numbers start at 0 in VS Code API
        fs.writeFileSync(testFilePath, `class TestClass {
  void myMethod() {}
  void _privateMethod() {}
  void main() {}
  void build() {}
  String get name => 'test';
  set name(String value) {}
}

void method1() {}
void method2() {}
void helperFunction() {}
`);
        
        mockVscodeCommands = {
            getDocumentSymbols: async () => []
        } as any;

        methodExtractor = new MethodExtractor(mockVscodeCommands, mockLogger);
    });

    teardown(() => {
        // Clean up temp file
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
        if (fs.existsSync(tempDir)) {
            fs.rmdirSync(tempDir);
        }
    });

    suite('Method Extraction', () => {
        test('should extract public methods', async () => {
            const mockSymbol: vscode.DocumentSymbol = {
                name: 'myMethod',
                kind: vscode.SymbolKind.Method,
                range: new vscode.Range(1, 2, 1, 24),  // Line 1: void myMethod() {}
                selectionRange: new vscode.Range(1, 7, 1, 15),
                children: []
            } as any;

            mockVscodeCommands.getDocumentSymbols = async () => [mockSymbol];

            const methods = await methodExtractor.extractMethods(testFilePath);

            assert.strictEqual(methods.length, 1, 'Should extract one method');
            assert.strictEqual(methods[0].name, 'myMethod');
            assert.strictEqual(methods[0].isPrivate, false);
        });

        test('should identify private methods', async () => {
            const mockSymbol: vscode.DocumentSymbol = {
                name: '_privateMethod',
                kind: vscode.SymbolKind.Method,
                range: new vscode.Range(2, 2, 2, 29),  // Line 2: void _privateMethod() {}
                selectionRange: new vscode.Range(2, 7, 2, 21),
                children: []
            } as any;

            mockVscodeCommands.getDocumentSymbols = async () => [mockSymbol];

            const methods = await methodExtractor.extractMethods(testFilePath);

            assert.strictEqual(methods.length, 1);
            assert.strictEqual(methods[0].isPrivate, true, 'Should identify private method');
        });

        test('should exclude main method', async () => {
            const mockSymbol: vscode.DocumentSymbol = {
                name: 'main',
                kind: vscode.SymbolKind.Function,
                range: new vscode.Range(0, 0, 2, 1),
                selectionRange: new vscode.Range(0, 5, 0, 9),
                children: []
            } as any;

            mockVscodeCommands.getDocumentSymbols = async () => [mockSymbol];

            const methods = await methodExtractor.extractMethods(testFilePath);

            assert.strictEqual(methods.length, 0, 'Should exclude main method');
        });

        test('should exclude build method', async () => {
            const mockSymbol: vscode.DocumentSymbol = {
                name: 'build',
                kind: vscode.SymbolKind.Method,
                range: new vscode.Range(10, 0, 15, 1),
                selectionRange: new vscode.Range(10, 2, 10, 7),
                children: []
            } as any;

            mockVscodeCommands.getDocumentSymbols = async () => [mockSymbol];

            const methods = await methodExtractor.extractMethods(testFilePath);

            assert.strictEqual(methods.length, 0, 'Should exclude build method');
        });

        test('should exclude getters', async () => {
            const mockSymbol: vscode.DocumentSymbol = {
                name: 'get name',
                kind: vscode.SymbolKind.Method,
                range: new vscode.Range(5, 0, 5, 20),
                selectionRange: new vscode.Range(5, 0, 5, 8),
                children: []
            } as any;

            mockVscodeCommands.getDocumentSymbols = async () => [mockSymbol];

            const methods = await methodExtractor.extractMethods(testFilePath);

            assert.strictEqual(methods.length, 0, 'Should exclude getters');
        });

        test('should exclude setters', async () => {
            const mockSymbol: vscode.DocumentSymbol = {
                name: 'set name',
                kind: vscode.SymbolKind.Method,
                range: new vscode.Range(5, 0, 5, 25),
                selectionRange: new vscode.Range(5, 0, 5, 8),
                children: []
            } as any;

            mockVscodeCommands.getDocumentSymbols = async () => [mockSymbol];

            const methods = await methodExtractor.extractMethods(testFilePath);

            assert.strictEqual(methods.length, 0, 'Should exclude setters');
        });

        test('should extract functions', async () => {
            const mockSymbol: vscode.DocumentSymbol = {
                name: 'helperFunction',
                kind: vscode.SymbolKind.Function,
                range: new vscode.Range(11, 0, 11, 24),  // Line 11: void helperFunction() {}
                selectionRange: new vscode.Range(11, 5, 11, 19),
                children: []
            } as any;

            mockVscodeCommands.getDocumentSymbols = async () => [mockSymbol];

            const methods = await methodExtractor.extractMethods(testFilePath);

            assert.strictEqual(methods.length, 1, 'Should extract top-level functions');
            assert.strictEqual(methods[0].name, 'helperFunction');
        });

        test('should track class names', async () => {
            const classSymbol: vscode.DocumentSymbol = {
                name: 'MyClass',
                kind: vscode.SymbolKind.Class,
                range: new vscode.Range(0, 0, 10, 1),
                selectionRange: new vscode.Range(0, 6, 0, 13),
                children: [
                    {
                        name: 'myMethod',
                        kind: vscode.SymbolKind.Method,
                        range: new vscode.Range(2, 2, 4, 3),
                        selectionRange: new vscode.Range(2, 7, 2, 15),
                        children: []
                    } as any
                ]
            } as any;

            mockVscodeCommands.getDocumentSymbols = async () => [classSymbol];

            const methods = await methodExtractor.extractMethods(testFilePath);

            assert.strictEqual(methods.length, 1);
            assert.strictEqual(methods[0].className, 'MyClass', 'Should track class name');
        });
    });

    suite('Error Handling', () => {
        test('should handle extraction errors gracefully', async () => {
            mockVscodeCommands.getDocumentSymbols = async () => {
                throw new Error('Test error');
            };

            const methods = await methodExtractor.extractMethods(testFilePath);

            assert.strictEqual(methods.length, 0, 'Should return empty array on error');
        });

        test('should handle null symbols', async () => {
            mockVscodeCommands.getDocumentSymbols = async () => null as any;

            const methods = await methodExtractor.extractMethods(testFilePath);

            assert.strictEqual(methods.length, 0, 'Should handle null symbols');
        });

        test('should handle empty symbols', async () => {
            mockVscodeCommands.getDocumentSymbols = async () => [];

            const methods = await methodExtractor.extractMethods(testFilePath);

            assert.strictEqual(methods.length, 0, 'Should handle empty symbols');
        });
    });

    suite('Multiple Methods', () => {
        test('should extract multiple methods from same file', async () => {
            const symbols = [
                {
                    name: 'method1',
                    kind: vscode.SymbolKind.Method,
                    range: new vscode.Range(5, 0, 7, 1),
                    selectionRange: new vscode.Range(5, 2, 5, 9),
                    children: []
                },
                {
                    name: 'method2',
                    kind: vscode.SymbolKind.Method,
                    range: new vscode.Range(9, 0, 11, 1),
                    selectionRange: new vscode.Range(9, 2, 9, 9),
                    children: []
                }
            ] as any[];

            mockVscodeCommands.getDocumentSymbols = async () => symbols;

            const methods = await methodExtractor.extractMethods(testFilePath);

            assert.strictEqual(methods.length, 2, 'Should extract both methods');
            assert.ok(methods.some(m => m.name === 'method1'));
            assert.ok(methods.some(m => m.name === 'method2'));
        });
    });
});
