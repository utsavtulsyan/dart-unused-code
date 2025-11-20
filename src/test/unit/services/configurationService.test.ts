import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigurationService } from '../../../services/configurationService';

suite('ConfigurationService Unit Tests', () => {
    let configService: ConfigurationService;

    setup(() => {
        configService = new ConfigurationService();
    });

    suite('Configuration Reading', () => {
        test('should read current configuration', () => {
            const config = configService.getConfiguration();

            assert.strictEqual(typeof config.enabled, 'boolean');
            assert.ok(Array.isArray(config.excludePatterns));
            assert.strictEqual(typeof config.severity, 'number');
            assert.strictEqual(typeof config.maxConcurrency, 'number');
            assert.strictEqual(typeof config.incrementalAnalysis, 'boolean');
        });

        test('should have default enabled value', () => {
            const config = configService.getConfiguration();
            assert.strictEqual(config.enabled, true);
        });

        test('should have default exclude patterns', () => {
            const config = configService.getConfiguration();
            assert.ok(config.excludePatterns.length > 0);
            assert.ok(config.excludePatterns.includes('**/*.g.dart'));
        });

        test('should have valid severity level', () => {
            const config = configService.getConfiguration();
            // Should be one of the DiagnosticSeverity values
            assert.ok(
                config.severity >= vscode.DiagnosticSeverity.Error &&
                config.severity <= vscode.DiagnosticSeverity.Hint
            );
        });

        test('should have positive max concurrency', () => {
            const config = configService.getConfiguration();
            assert.ok(config.maxConcurrency > 0);
            assert.ok(config.maxConcurrency <= 20);
        });
    });

    suite('Severity Mapping', () => {
        test('should map Warning severity correctly', () => {
            // This tests the internal mapping from string to DiagnosticSeverity
            const config = configService.getConfiguration();
            // Default is Warning
            assert.strictEqual(config.severity, vscode.DiagnosticSeverity.Warning);
        });
    });

    suite('Exclude Patterns', () => {
        test('should include generated file patterns', () => {
            const config = configService.getConfiguration();
            const patterns = config.excludePatterns;

            assert.ok(patterns.includes('**/*.g.dart'));
            assert.ok(patterns.includes('**/*.freezed.dart'));
            assert.ok(patterns.includes('**/*.gr.dart'));
        });

        test('should include test file patterns', () => {
            const config = configService.getConfiguration();
            const patterns = config.excludePatterns;

            assert.ok(patterns.some(p => p.includes('test')));
        });

        test('should include build directories', () => {
            const config = configService.getConfiguration();
            const patterns = config.excludePatterns;

            assert.ok(patterns.some(p => p.includes('build')));
            assert.ok(patterns.some(p => p.includes('.dart_tool')));
        });
    });
});
