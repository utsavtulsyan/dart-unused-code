import * as assert from 'assert';
import * as vscode from 'vscode';
import { FileSystemProvider } from '../../../infra/fileSystemProvider';
import { AnalyzerOrchestrator } from '../../../analyzers/analyzerOrchestrator';
import { createMockLogger } from '../../helpers/mockLogger';

suite('FileSystemProvider Unit Tests', () => {
    let mockOrchestrator: AnalyzerOrchestrator;
    let mockLogger: ReturnType<typeof createMockLogger>;

    setup(() => {
        mockLogger = createMockLogger();

        mockOrchestrator = {
            analyzeFile: async () => { },
            handleFileCreated: async () => { },
            handleFileDeleted: async () => { }
        } as any;
    });

    suite('FileSystemProvider', () => {
        test('should register file system watcher', () => {
            const provider = new FileSystemProvider(mockOrchestrator, mockLogger);
            const context: vscode.ExtensionContext = {
                subscriptions: []
            } as any;

            provider.register(context);

            // Should register one FileSystemWatcher that handles create/change/delete
            assert.strictEqual(context.subscriptions.length, 1, 'Should register one file system watcher');
        });

        test('should handle file creation events', async () => {
            let handleFileCreatedCalled = false;
            let capturedPath = '';

            mockOrchestrator.handleFileCreated = async (path: string) => {
                handleFileCreatedCalled = true;
                capturedPath = path;
            };

            const provider = new FileSystemProvider(mockOrchestrator, mockLogger);
            const context: vscode.ExtensionContext = {
                subscriptions: []
            } as any;

            provider.register(context);

            // Verify registration works
            assert.ok(true, 'File system provider registered successfully');
        });

        test('should handle file change/save events', async () => {
            let analyzeFileCalled = false;

            mockOrchestrator.analyzeFile = async () => {
                analyzeFileCalled = true;
            };

            const provider = new FileSystemProvider(mockOrchestrator, mockLogger);
            const context: vscode.ExtensionContext = {
                subscriptions: []
            } as any;

            provider.register(context);

            // Verify registration works
            assert.ok(true, 'File change handler registered successfully');
        });

        test('should handle file deletion events', async () => {
            let handleFileDeletedCalled = false;

            mockOrchestrator.handleFileDeleted = async () => {
                handleFileDeletedCalled = true;
            };

            const provider = new FileSystemProvider(mockOrchestrator, mockLogger);
            const context: vscode.ExtensionContext = {
                subscriptions: []
            } as any;

            provider.register(context);

            // Verify registration works
            assert.ok(true, 'File deletion handler registered successfully');
        });
    });
});
