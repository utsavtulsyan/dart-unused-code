import * as vscode from 'vscode';
import { LoggingService, ChildLogger } from '../services/loggingService';

/**
 * Logger interface for components that need logging
 */
export type Logger = LoggingService | ChildLogger;

/**
 * Represents a method declaration in Dart code.
 */
export interface MethodInfo {
    readonly name: string;
    readonly filePath: string;
    readonly range: vscode.Range;
    readonly isPrivate: boolean;
    readonly className?: string; // Optional class name for context
}

/**
 * Configuration for the analyzer.
 */
export interface AnalyzerConfig {
    enabled: boolean;
    sourceDirectory: string;
    excludePatterns: string[];
    severity: vscode.DiagnosticSeverity;
    maxConcurrency: number;
    incrementalAnalysis: boolean;
    analysisDelay: number;
    unusedCodeReanalysisIntervalMinutes: number;
}

/**
 * Result of analyzing a single method.
 */
export interface MethodAnalysisResult {
    readonly method: MethodInfo;
    readonly isUnused: boolean;
    readonly referenceCount: number;
}
