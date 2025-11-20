import * as vscode from 'vscode';
import { AnalyzerConfig } from '../shared/types';

interface ConfigValidationError {
    field: string;
    message: string;
}

/**
 * Configuration service with validation
 */
export class ConfigurationService {
    private static readonly CONFIG_SECTION = 'dartUnusedCode';

    getConfiguration(): AnalyzerConfig {
        const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);

        const rawConfig = {
            enabled: config.get<boolean>('enabled', true),
            sourceDirectory: config.get<string>('sourceDirectory', 'lib'),
            excludePatterns: config.get<string[]>('excludePatterns') || [],
            severity: config.get<string>('severity', 'Warning'),
            maxConcurrency: config.get<number>('maxConcurrency', 5),
            incrementalAnalysis: config.get<boolean>('incrementalAnalysis', true),
            analysisDelay: config.get<number>('analysisDelay', 2000),
            unusedCodeReanalysisIntervalMinutes: config.get<number>('unusedCodeReanalysisIntervalMinutes', 3)
        };

        this.validateConfiguration(rawConfig);

        return {
            enabled: rawConfig.enabled,
            sourceDirectory: rawConfig.sourceDirectory,
            excludePatterns: rawConfig.excludePatterns,
            severity: this.parseSeverity(rawConfig.severity),
            maxConcurrency: rawConfig.maxConcurrency,
            incrementalAnalysis: rawConfig.incrementalAnalysis,
            analysisDelay: rawConfig.analysisDelay,
            unusedCodeReanalysisIntervalMinutes: rawConfig.unusedCodeReanalysisIntervalMinutes
        };
    }

    onDidChangeConfiguration(
        listener: (config: AnalyzerConfig, event: vscode.ConfigurationChangeEvent) => void
    ): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(ConfigurationService.CONFIG_SECTION)) {
                const updatedConfig = this.getConfiguration();
                listener(updatedConfig, event);
            }
        });
    }

    private validateConfiguration(config: Record<string, unknown>): void {
        const errors: ConfigValidationError[] = [];

        const enabled = config.enabled;
        if (typeof enabled !== 'boolean') {
            errors.push({ field: 'enabled', message: 'Must be a boolean' });
        }

        const sourceDirectory = config.sourceDirectory;
        if (typeof sourceDirectory !== 'string') {
            errors.push({ field: 'sourceDirectory', message: 'Must be a string' });
        } else if (sourceDirectory.trim() === '') {
            errors.push({ field: 'sourceDirectory', message: 'Must not be empty' });
        }

        const excludePatterns = config.excludePatterns;
        if (!Array.isArray(excludePatterns)) {
            errors.push({ field: 'excludePatterns', message: 'Must be an array of strings' });
        } else if (excludePatterns.some((p: unknown) => typeof p !== 'string')) {
            errors.push({ field: 'excludePatterns', message: 'All patterns must be strings' });
        }

        const severity = config.severity;
        if (typeof severity !== 'string' || !['Error', 'Warning', 'Information', 'Hint'].includes(severity)) {
            errors.push({ field: 'severity', message: 'Must be one of: Error, Warning, Information, Hint' });
        }

        const analysisDelay = config.analysisDelay;
        if (typeof analysisDelay !== 'number' || analysisDelay < 0 || analysisDelay > 900000) {
            errors.push({ field: 'analysisDelay', message: 'Must be a number between 0 and 900000 (15 minutes)' });
        }

        const reanalysisInterval = config.unusedCodeReanalysisIntervalMinutes;
        if (typeof reanalysisInterval !== 'number'
            || reanalysisInterval < 0
            || reanalysisInterval > 1440) {
            errors.push({ field: 'unusedCodeReanalysisIntervalMinutes', message: 'Must be a number between 0 and 1440 (minutes)' });
        }

        const maxConcurrency = config.maxConcurrency;
        if (typeof maxConcurrency !== 'number' || maxConcurrency < 1 || maxConcurrency > 20) {
            errors.push({ field: 'maxConcurrency', message: 'Must be a number between 1 and 20' });
        }

        if (errors.length > 0) {
            const message = `Configuration validation errors:\n${errors.map(e => `- ${e.field}: ${e.message}`).join('\n')}`;
            vscode.window.showErrorMessage(message);
        }
    }

    private parseSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'Error': return vscode.DiagnosticSeverity.Error;
            case 'Warning': return vscode.DiagnosticSeverity.Warning;
            case 'Hint': return vscode.DiagnosticSeverity.Hint;
            default: return vscode.DiagnosticSeverity.Information;
        }
    }
}