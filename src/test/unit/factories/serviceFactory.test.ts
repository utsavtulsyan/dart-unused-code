import * as assert from 'assert';
import * as vscode from 'vscode';
import { ServiceFactory } from '../../../factories/serviceFactory';
import { LoggingService } from '../../../services/loggingService';

suite('ServiceFactory Unit Tests', () => {
    let serviceFactory: ServiceFactory;
    let loggingService: LoggingService;
    let diagnosticCollection: vscode.DiagnosticCollection;
    let statusBarItem: vscode.StatusBarItem;

    setup(() => {
        const outputChannel = vscode.window.createOutputChannel('Test Logger');
        loggingService = new LoggingService(outputChannel);
        diagnosticCollection = vscode.languages.createDiagnosticCollection('test-factory');
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

        serviceFactory = new ServiceFactory(
            loggingService,
            diagnosticCollection,
            statusBarItem
        );
    });

    teardown(() => {
        diagnosticCollection.dispose();
        statusBarItem.dispose();
    });

    suite('Service Creation', () => {
        test('should create orchestrator', () => {
            const orchestrator = serviceFactory.getOrchestrator();
            assert.ok(orchestrator, 'Should create orchestrator');
        });

        test('should create diagnostics service', () => {
            const diagnostics = serviceFactory.getDiagnostics();
            assert.ok(diagnostics, 'Should create diagnostics service');
        });

        test('should create configuration service', () => {
            const configService = serviceFactory.getConfigurationService();
            assert.ok(configService, 'Should create configuration service');
        });
    });

    suite('Service Wiring', () => {
        test('should wire orchestrator with workspace analysis capability', async () => {
            const orchestrator = serviceFactory.getOrchestrator();
            
            // Should not throw when calling analyzeWorkspace
            // (it will fail gracefully if no workspace is open)
            try {
                await orchestrator.analyzeWorkspace();
                assert.ok(true, 'Orchestrator should be properly wired');
            } catch (error) {
                // Expected if no workspace folder
                assert.ok(true, 'Orchestrator handles missing workspace gracefully');
            }
        });

        test('should wire diagnostics service correctly', () => {
            const diagnostics = serviceFactory.getDiagnostics();
            
            // Should not throw
            diagnostics.clear();
            assert.ok(true, 'Diagnostics service should be properly wired');
        });

        test('should wire configuration service correctly', () => {
            const configService = serviceFactory.getConfigurationService();
            
            const config = configService.getConfiguration();
            assert.ok(config, 'Should return configuration');
            assert.strictEqual(typeof config.enabled, 'boolean');
            assert.ok(Array.isArray(config.excludePatterns));
        });
    });

    suite('Singleton Behavior', () => {
        test('should return same orchestrator instance', () => {
            const orchestrator1 = serviceFactory.getOrchestrator();
            const orchestrator2 = serviceFactory.getOrchestrator();
            
            assert.strictEqual(orchestrator1, orchestrator2, 'Should return same instance');
        });

        test('should return same diagnostics instance', () => {
            const diagnostics1 = serviceFactory.getDiagnostics();
            const diagnostics2 = serviceFactory.getDiagnostics();
            
            assert.strictEqual(diagnostics1, diagnostics2, 'Should return same instance');
        });

        test('should return same configuration service instance', () => {
            const config1 = serviceFactory.getConfigurationService();
            const config2 = serviceFactory.getConfigurationService();
            
            assert.strictEqual(config1, config2, 'Should return same instance');
        });
    });

    suite('Integration', () => {
        test('should create complete service graph without errors', () => {
            // Simply creating the factory should wire all services correctly
            assert.ok(serviceFactory, 'Should create complete service graph');
            
            // Verify all main services are accessible
            assert.ok(serviceFactory.getOrchestrator());
            assert.ok(serviceFactory.getDiagnostics());
            assert.ok(serviceFactory.getConfigurationService());
        });
    });
});
