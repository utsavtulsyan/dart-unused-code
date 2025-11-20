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

/**
 * Scope of files to analyze
 */
export enum AnalysisScopeType {
    /** All workspace files */
    WORKSPACE = 'workspace',
    /** Specific files only */
    FILES = 'files',
    /** Single file plus its dependencies */
    FILE_WITH_DEPENDENCIES = 'file_with_dependencies',
}

/**
 * Defines which files to analyze
 */
export interface AnalysisScope {
    type: AnalysisScopeType;
    /** Target files (for FILES and FILE_WITH_DEPENDENCIES) */
    files?: string[];
    /** Whether to include dependencies (resolved during execution) */
    includeDependencies?: boolean;
}

/**
 * Types of atomic analysis operations
 */
export enum AnalysisOperationType {
    /** Extract methods from files */
    EXTRACT_METHODS = 'extract_methods',
    /** Check references for methods */
    CHECK_REFERENCES = 'check_references',
    /** Clear cached data for files */
    CLEAR_CACHE = 'clear_cache',
}

/**
 * Atomic analysis operation
 */
export interface AnalysisOperation {
    type: AnalysisOperationType;
    /** Files to operate on (resolved at execution time) */
    files: string[];
}

/**
 * Composed analysis task with multiple operations
 */
export interface AnalysisTask {
    id: string;
    scope: AnalysisScope;
    operations: AnalysisOperation[];
    /** Timestamp when task was created */
    timestamp: number;
}

/**
 * Result of merging analysis tasks
 */
export interface MergeResult {
    /** Whether tasks were merged */
    merged: boolean;
    /** Resulting task after merge (if merged) */
    task?: AnalysisTask;
    /** Reason for not merging (if not merged) */
    reason?: string;
}
