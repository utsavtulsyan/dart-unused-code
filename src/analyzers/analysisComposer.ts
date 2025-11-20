import {
    AnalysisScope,
    AnalysisScopeType,
    AnalysisTask,
    AnalysisOperation,
    AnalysisOperationType,
} from '../shared/types';

/**
 * Simple unique ID generator
 */
let taskIdCounter = 0;
function generateTaskId(): string {
    return `task-${Date.now()}-${++taskIdCounter}`;
}

/**
 * Composes atomic analysis operations into complete analysis tasks.
 * Provides factory methods for common analysis patterns.
 */
export class AnalysisComposer {
    /**
     * Creates a workspace analysis task.
     * Analyzes all files: extract methods + check references.
     */
    public static composeWorkspaceAnalysis(): AnalysisTask {
        const scope: AnalysisScope = {
            type: AnalysisScopeType.WORKSPACE,
        };

        const operations: AnalysisOperation[] = [
            {
                type: AnalysisOperationType.EXTRACT_METHODS,
                files: [], // Will be resolved to all workspace files
            },
            {
                type: AnalysisOperationType.CHECK_REFERENCES,
                files: [], // Will be resolved to all workspace files
            },
        ];

        return this.createTask(scope, operations);
    }

    /**
     * Creates a file creation/update analysis task.
     * Analyzes the file and its dependencies: extract methods + check references.
     * 
     * @param filePath - The file that was created/updated
     */
    public static composeFileWithDependenciesAnalysis(filePath: string): AnalysisTask {
        const scope: AnalysisScope = {
            type: AnalysisScopeType.FILE_WITH_DEPENDENCIES,
            files: [filePath],
            includeDependencies: true,
        };

        const operations: AnalysisOperation[] = [
            {
                type: AnalysisOperationType.EXTRACT_METHODS,
                files: [], // Will be resolved to file + dependencies
            },
            {
                type: AnalysisOperationType.CHECK_REFERENCES,
                files: [], // Will be resolved to file + dependencies
            },
        ];

        return this.createTask(scope, operations);
    }

    /**
     * Creates a file deletion analysis task.
     * Clears cache for deleted file, then analyzes dependents.
     * 
     * @param filePath - The file that was deleted
     */
    public static composeFileDeletionAnalysis(filePath: string): AnalysisTask {
        const scope: AnalysisScope = {
            type: AnalysisScopeType.FILE_WITH_DEPENDENCIES,
            files: [filePath],
            includeDependencies: true,
        };

        const operations: AnalysisOperation[] = [
            {
                type: AnalysisOperationType.CLEAR_CACHE,
                files: [filePath],
            },
            {
                type: AnalysisOperationType.EXTRACT_METHODS,
                files: [], // Will be resolved to dependents only (not deleted file)
            },
            {
                type: AnalysisOperationType.CHECK_REFERENCES,
                files: [], // Will be resolved to dependents only
            },
        ];

        return this.createTask(scope, operations);
    }

    /**
     * Creates a reference recheck analysis task.
     * Only checks references for already-extracted methods, skips extraction.
     * 
     * @param files - Optional specific files to recheck (empty = all cached methods)
     */
    public static composeReferenceRecheckAnalysis(files?: string[]): AnalysisTask {
        const scope: AnalysisScope = {
            type: files && files.length > 0 ? AnalysisScopeType.FILES : AnalysisScopeType.WORKSPACE,
            files,
        };

        const operations: AnalysisOperation[] = [
            {
                type: AnalysisOperationType.CHECK_REFERENCES,
                files: files || [], // Will be resolved to cached methods
            },
        ];

        return this.createTask(scope, operations);
    }

    /**
     * Creates a custom analysis task with specific operations.
     * 
     * @param scope - Analysis scope
     * @param operations - List of operations to perform
     */
    public static composeCustomAnalysis(
        scope: AnalysisScope,
        operations: AnalysisOperation[]
    ): AnalysisTask {
        return this.createTask(scope, operations);
    }

    /**
     * Creates an analysis task with a unique ID and timestamp.
     */
    private static createTask(scope: AnalysisScope, operations: AnalysisOperation[]): AnalysisTask {
        return {
            id: generateTaskId(),
            scope,
            operations,
            timestamp: Date.now(),
        };
    }

    /**
     * Checks if a scope is a superset of another scope.
     * Used for determining if one task subsumes another.
     * 
     * @param superScope - The potentially larger scope
     * @param subScope - The potentially smaller scope
     * @returns true if superScope contains all files in subScope
     */
    public static isScopeSuperset(superScope: AnalysisScope, subScope: AnalysisScope): boolean {
        // WORKSPACE subsumes everything
        if (superScope.type === AnalysisScopeType.WORKSPACE) {
            return true;
        }

        // WORKSPACE cannot be subsumed by non-WORKSPACE
        if (subScope.type === AnalysisScopeType.WORKSPACE) {
            return false;
        }

        // Both are file-based scopes - check if all files in subScope are in superScope
        const superFiles = new Set(superScope.files || []);
        const subFiles = subScope.files || [];

        return subFiles.every(file => superFiles.has(file));
    }

    /**
     * Merges two scopes by combining their files.
     * 
     * @param scope1 - First scope
     * @param scope2 - Second scope
     * @returns Merged scope
     */
    public static mergeScopes(scope1: AnalysisScope, scope2: AnalysisScope): AnalysisScope {
        // If either is WORKSPACE, result is WORKSPACE
        if (
            scope1.type === AnalysisScopeType.WORKSPACE ||
            scope2.type === AnalysisScopeType.WORKSPACE
        ) {
            return { type: AnalysisScopeType.WORKSPACE };
        }

        // Merge file lists
        const files1 = new Set(scope1.files || []);
        const files2 = new Set(scope2.files || []);
        const mergedFiles = Array.from(new Set([...files1, ...files2]));

        // Determine type: prefer FILE_WITH_DEPENDENCIES if either has it
        const type =
            scope1.type === AnalysisScopeType.FILE_WITH_DEPENDENCIES ||
                scope2.type === AnalysisScopeType.FILE_WITH_DEPENDENCIES
                ? AnalysisScopeType.FILE_WITH_DEPENDENCIES
                : AnalysisScopeType.FILES;

        return {
            type,
            files: mergedFiles,
            includeDependencies: scope1.includeDependencies || scope2.includeDependencies,
        };
    }

    /**
     * Merges two operation lists, removing duplicates.
     * 
     * @param ops1 - First operation list
     * @param ops2 - Second operation list
     * @returns Merged and deduplicated operations
     */
    public static mergeOperations(
        ops1: AnalysisOperation[],
        ops2: AnalysisOperation[]
    ): AnalysisOperation[] {
        const operationMap = new Map<AnalysisOperationType, Set<string>>();

        // Collect all operations
        for (const op of [...ops1, ...ops2]) {
            if (!operationMap.has(op.type)) {
                operationMap.set(op.type, new Set());
            }
            op.files.forEach(file => operationMap.get(op.type)!.add(file));
        }

        // Convert back to operation list
        return Array.from(operationMap.entries()).map(([type, files]) => ({
            type,
            files: Array.from(files),
        }));
    }
}
