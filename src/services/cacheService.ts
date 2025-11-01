import { MethodInfo, Logger } from '../shared/types';

/**
 * Service for caching unused method information.
 * Provides efficient lookup and updates for incremental analysis.
 */
export class CacheService {
    // Map<filePath:line, MethodInfo>
    private readonly unusedMethodsCache: Map<string, MethodInfo> = new Map();

    constructor(
        private readonly logger: Logger
    ) {}

    /**
     * Generates a unique key for a method.
     */
    private getKey(method: MethodInfo): string {
        return `${method.filePath}:${method.range.start.line}`;
    }

    /**
     * Adds or updates an unused method in the cache.
     */
    add(method: MethodInfo): void {
        const key = this.getKey(method);
        this.unusedMethodsCache.set(key, method);
    }

    /**
     * Removes a method from the cache.
     */
    remove(method: MethodInfo): void {
        const key = this.getKey(method);
        this.unusedMethodsCache.delete(key);
    }

    /**
     * Gets an unused method by key.
     */
    get(filePath: string, line: number): MethodInfo | undefined {
        const key = `${filePath}:${line}`;
        return this.unusedMethodsCache.get(key);
    }

    /**
     * Checks if a method is in the cache.
     */
    has(method: MethodInfo): boolean {
        const key = this.getKey(method);
        return this.unusedMethodsCache.has(key);
    }

    /**
     * Gets all unused methods for a specific file.
     */
    getForFile(filePath: string): MethodInfo[] {
        const methods: MethodInfo[] = [];
        for (const [key, method] of this.unusedMethodsCache) {
            if (method.filePath === filePath) {
                methods.push(method);
            }
        }
        return methods;
    }

    /**
     * Gets all unused methods in the specified files.
     */
    getForFiles(filePaths: Set<string>): MethodInfo[] {
        const methods: MethodInfo[] = [];
        for (const [key, method] of this.unusedMethodsCache) {
            if (filePaths.has(method.filePath)) {
                methods.push(method);
            }
        }
        return methods;
    }

    /**
     * Updates the cache for a file.
     * Removes all existing entries for the file and adds new ones.
     */
    updateFile(filePath: string, unusedMethods: MethodInfo[]): void {
        // Remove old entries for this file
        this.clearFile(filePath);

        // Add new entries
        for (const method of unusedMethods) {
            this.add(method);
        }

        this.logger.debug(`Updated ${filePath}: ${unusedMethods.length} unused methods`);
    }

    /**
     * Removes all cached entries for a file.
     */
    clearFile(filePath: string): void {
        const keysToDelete: string[] = [];
        for (const [key, method] of this.unusedMethodsCache) {
            if (method.filePath === filePath) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            this.unusedMethodsCache.delete(key);
        }
    }

    /**
     * Clears all cached data.
     */
    clear(): void {
        this.unusedMethodsCache.clear();
        this.logger.debug('Cleared all cached data');
    }

    /**
     * Gets the total number of cached unused methods.
     */
    get size(): number {
        return this.unusedMethodsCache.size;
    }

    /**
     * Gets all cached unused methods.
     */
    getAll(): MethodInfo[] {
        return Array.from(this.unusedMethodsCache.values());
    }

    /**
     * Populates the cache with a list of unused methods.
     */
    populate(unusedMethods: MethodInfo[]): void {
        this.clear();
        for (const method of unusedMethods) {
            this.add(method);
        }
        this.logger.debug(`Populated with ${this.size} unused methods`);
    }
}
