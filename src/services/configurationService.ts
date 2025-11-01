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
            analyzeOnSave: config.get<boolean>('analyzeOnSave', true),
            analysisDelay: config.get<number>('analysisDelay', 2000)
        };

        this.validateConfiguration(rawConfig);

        return {
            enabled: rawConfig.enabled,
            sourceDirectory: rawConfig.sourceDirectory,
            excludePatterns: rawConfig.excludePatterns,
            severity: this.parseSeverity(rawConfig.severity),
            maxConcurrency: rawConfig.maxConcurrency,
            analyzeOnSave: rawConfig.analyzeOnSave,
            analysisDelay: rawConfig.analysisDelay
        };
    }

    private validateConfiguration(config: any): void {
        const errors: ConfigValidationError[] = [];

        if (typeof config.enabled !== 'boolean') {
            errors.push({ field: 'enabled', message: 'Must be a boolean' });
        }

        if (typeof config.sourceDirectory !== 'string') {
            errors.push({ field: 'sourceDirectory', message: 'Must be a string' });
        } else if (config.sourceDirectory.trim() === '') {
            errors.push({ field: 'sourceDirectory', message: 'Must not be empty' });
        }

        if (!Array.isArray(config.excludePatterns)) {
            errors.push({ field: 'excludePatterns', message: 'Must be an array of strings' });
        } else if (config.excludePatterns.some((p: any) => typeof p !== 'string')) {
            errors.push({ field: 'excludePatterns', message: 'All patterns must be strings' });
        }

        if (!['Error', 'Warning', 'Information', 'Hint'].includes(config.severity)) {
            errors.push({ field: 'severity', message: 'Must be one of: Error, Warning, Information, Hint' });
        }

        if (typeof config.analysisDelay !== 'number' || config.analysisDelay < 0 || config.analysisDelay > 900000) {
            errors.push({ field: 'analysisDelay', message: 'Must be a number between 0 and 900000 (15 minutes)' });
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