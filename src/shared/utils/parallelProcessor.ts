/**
 * Utility for controlled parallel execution with concurrency limits
 */
export class ParallelProcessor {
    static async processWithConcurrencyAndIndex<T, R>(
        items: T[],
        processor: (item: T, index: number) => Promise<R>,
        maxConcurrency: number = 5,
        onProgress?: (completed: number, total: number) => void
    ): Promise<R[]> {
        // Handle empty array case
        if (items.length === 0) {
            return Promise.resolve([]);
        }

        return new Promise((resolve, reject) => {
            const results: R[] = new Array(items.length);
            let completed = 0;
            let started = 0;
            
            const startNext = () => {
                if (started >= items.length) {
                    return;
                }
                
                const index = started++;
                processor(items[index], index)
                    .then(result => {
                        results[index] = result;
                        completed++;
                        
                        if (onProgress) {
                            onProgress(completed, items.length);
                        }
                        
                        if (completed === items.length) {
                            resolve(results);
                        } else {
                            startNext();
                        }
                    })
                    .catch(reject);
            };
            
            // Start initial batch
            for (let i = 0; i < Math.min(maxConcurrency, items.length); i++) {
                startNext();
            }
        });
    }
}