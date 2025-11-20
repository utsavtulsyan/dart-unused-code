import { AnalysisTask, AnalysisScopeType, MergeResult, Logger } from '../shared/types';
import { AnalysisComposer } from './analysisComposer';

/**
 * Queues and merges analysis tasks to optimize processing.
 * Implements intelligent merging based on scope overlap.
 */
export class AnalysisQueue {
    private queue: AnalysisTask[] = [];
    private processing = false;

    constructor(private readonly logger: Logger) { }

    /**
     * Adds a task to the queue, attempting to merge with existing tasks.
     * 
     * @param task - The analysis task to enqueue
     * @returns The task ID (may be a merged task ID)
     */
    public enqueue(task: AnalysisTask): string {
        this.logger.debug(`Enqueuing task ${task.id} (${task.scope.type})`);

        // Try to merge with existing tasks
        const mergeResult = this.tryMergeWithQueue(task);

        if (mergeResult.merged && mergeResult.task) {
            this.logger.debug(
                `Task ${task.id} merged with existing task ${mergeResult.task.id}: ${mergeResult.reason}`
            );
            return mergeResult.task.id;
        }

        // No merge possible, add to queue
        this.queue.push(task);
        this.logger.debug(`Task ${task.id} added to queue (queue size: ${this.queue.length})`);
        return task.id;
    }

    /**
     * Attempts to merge a task with existing queued tasks.
     * 
     * @param newTask - Task to merge
     * @returns Merge result
     */
    private tryMergeWithQueue(newTask: AnalysisTask): MergeResult {
        for (let i = 0; i < this.queue.length; i++) {
            const existingTask = this.queue[i];
            const mergeResult = this.tryMergeTasks(existingTask, newTask);

            if (mergeResult.merged && mergeResult.task) {
                // Replace existing task with merged task
                this.queue[i] = mergeResult.task;
                return mergeResult;
            }
        }

        return { merged: false, reason: 'No compatible tasks in queue' };
    }

    /**
     * Attempts to merge two tasks based on their scopes and operations.
     * 
     * Merge rules:
     * 1. WORKSPACE subsumes everything -> drop other task
     * 2. Same files -> merge operations
     * 3. Overlapping files -> merge scopes and operations
     * 4. No overlap -> cannot merge
     * 
     * @param task1 - First task
     * @param task2 - Second task
     * @returns Merge result with merged task if successful
     */
    private tryMergeTasks(task1: AnalysisTask, task2: AnalysisTask): MergeResult {
        // Rule 1: WORKSPACE subsumes everything
        if (task1.scope.type === AnalysisScopeType.WORKSPACE) {
            return {
                merged: true,
                task: task1,
                reason: 'Existing workspace task subsumes new task',
            };
        }

        if (task2.scope.type === AnalysisScopeType.WORKSPACE) {
            return {
                merged: true,
                task: task2,
                reason: 'New workspace task subsumes existing task',
            };
        }

        // Rule 2 & 3: Check for file overlap
        const files1 = new Set(task1.scope.files || []);
        const files2 = new Set(task2.scope.files || []);

        // Calculate overlap
        const intersection = new Set([...files1].filter(f => files2.has(f)));
        const hasOverlap = intersection.size > 0;

        if (!hasOverlap && files1.size > 0 && files2.size > 0) {
            // Rule 4: No overlap, cannot merge
            return {
                merged: false,
                reason: 'No file overlap between tasks',
            };
        }

        // Merge scopes and operations
        const mergedScope = AnalysisComposer.mergeScopes(task1.scope, task2.scope);
        const mergedOperations = AnalysisComposer.mergeOperations(
            task1.operations,
            task2.operations
        );

        // Use the earlier timestamp
        const timestamp = Math.min(task1.timestamp, task2.timestamp);

        const mergedTask: AnalysisTask = {
            id: task1.id, // Keep the existing task ID
            scope: mergedScope,
            operations: mergedOperations,
            timestamp,
        };

        return {
            merged: true,
            task: mergedTask,
            reason: hasOverlap ? 'Tasks have overlapping files' : 'Tasks merged',
        };
    }

    /**
     * Dequeues the next task for processing.
     * 
     * @returns The next task, or undefined if queue is empty
     */
    public dequeue(): AnalysisTask | undefined {
        const task = this.queue.shift();
        if (task) {
            this.logger.debug(`Dequeued task ${task.id} (remaining: ${this.queue.length})`);
        }
        return task;
    }

    /**
     * Peeks at the next task without removing it.
     */
    public peek(): AnalysisTask | undefined {
        return this.queue[0];
    }

    /**
     * Returns the current queue size.
     */
    public size(): number {
        return this.queue.length;
    }

    /**
     * Checks if queue is empty.
     */
    public isEmpty(): boolean {
        return this.queue.length === 0;
    }

    /**
     * Clears all queued tasks.
     */
    public clear(): void {
        const clearedCount = this.queue.length;
        this.queue = [];
        this.logger.debug(`Queue cleared (${clearedCount} tasks removed)`);
    }

    /**
     * Sets processing state.
     */
    public setProcessing(isProcessing: boolean): void {
        this.processing = isProcessing;
    }

    /**
     * Checks if currently processing.
     */
    public isProcessing(): boolean {
        return this.processing;
    }

    /**
     * Gets a summary of queued tasks for debugging.
     */
    public getSummary(): string {
        if (this.queue.length === 0) {
            return 'Queue is empty';
        }

        const summary = this.queue.map((task, idx) => {
            const fileCount = task.scope.files?.length || 'all';
            const opTypes = task.operations.map(op => op.type).join(', ');
            return `  ${idx + 1}. ${task.scope.type} (${fileCount} files) - ${opTypes}`;
        });

        return `Queue (${this.queue.length} tasks):\n${summary.join('\n')}`;
    }
}
