import * as assert from 'assert';
import { ParallelProcessor } from '../../../../shared/utils/parallelProcessor';

suite('ParallelProcessor Unit Tests', () => {
    suite('Basic Processing', () => {
        test('should process items sequentially with concurrency 1', async () => {
            const items = [1, 2, 3, 4, 5];
            const processing: number[] = [];
            const completed: number[] = [];
            
            const processor = async (item: number, index: number) => {
                processing.push(item);
                await new Promise(resolve => setTimeout(resolve, 10));
                completed.push(item);
                return item * 2;
            };
            
            const results = await ParallelProcessor.processWithConcurrencyAndIndex(
                items,
                processor,
                1
            );
            
            assert.deepStrictEqual(results, [2, 4, 6, 8, 10]);
            assert.deepStrictEqual(completed, [1, 2, 3, 4, 5]);
        });

        test('should process items in parallel with higher concurrency', async () => {
            const items = [1, 2, 3, 4, 5];
            const results = await ParallelProcessor.processWithConcurrencyAndIndex(
                items,
                async (item) => item * 2,
                3
            );
            
            assert.deepStrictEqual(results, [2, 4, 6, 8, 10]);
        });

        test('should preserve order of results', async () => {
            const items = [1, 2, 3, 4, 5];
            // Simulate varying processing times
            const processor = async (item: number) => {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
                return item * 2;
            };
            
            const results = await ParallelProcessor.processWithConcurrencyAndIndex(
                items,
                processor,
                3
            );
            
            // Results should still be in original order
            assert.deepStrictEqual(results, [2, 4, 6, 8, 10]);
        });

        test('should handle empty array', async () => {
            const results = await ParallelProcessor.processWithConcurrencyAndIndex(
                [],
                async (item) => item,
                3
            );
            
            assert.deepStrictEqual(results, []);
        });

        test('should handle single item', async () => {
            const results = await ParallelProcessor.processWithConcurrencyAndIndex(
                [42],
                async (item) => item * 2,
                3
            );
            
            assert.deepStrictEqual(results, [84]);
        });
    });

    suite('Concurrency Control', () => {
        test('should respect concurrency limit', async () => {
            const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            let currentConcurrency = 0;
            let maxConcurrency = 0;
            
            const processor = async (item: number) => {
                currentConcurrency++;
                maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
                await new Promise(resolve => setTimeout(resolve, 10));
                currentConcurrency--;
                return item;
            };
            
            await ParallelProcessor.processWithConcurrencyAndIndex(
                items,
                processor,
                3
            );
            
            assert.ok(maxConcurrency <= 3);
        });

        test('should default to concurrency of 5', async () => {
            const items = Array.from({ length: 10 }, (_, i) => i);
            let currentConcurrency = 0;
            let maxConcurrency = 0;
            
            const processor = async (item: number) => {
                currentConcurrency++;
                maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
                await new Promise(resolve => setTimeout(resolve, 10));
                currentConcurrency--;
                return item;
            };
            
            await ParallelProcessor.processWithConcurrencyAndIndex(
                items,
                processor
            );
            
            assert.ok(maxConcurrency <= 5);
        });

        test('should handle concurrency higher than items count', async () => {
            const items = [1, 2, 3];
            const results = await ParallelProcessor.processWithConcurrencyAndIndex(
                items,
                async (item) => item * 2,
                10
            );
            
            assert.deepStrictEqual(results, [2, 4, 6]);
        });
    });

    suite('Index Tracking', () => {
        test('should pass correct index to processor', async () => {
            const items = ['a', 'b', 'c', 'd', 'e'];
            const indices: number[] = [];
            
            const processor = async (item: string, index: number) => {
                indices.push(index);
                return `${item}-${index}`;
            };
            
            const results = await ParallelProcessor.processWithConcurrencyAndIndex(
                items,
                processor,
                2
            );
            
            assert.deepStrictEqual(results, ['a-0', 'b-1', 'c-2', 'd-3', 'e-4']);
            // All indices should be present (though not necessarily in order)
            assert.deepStrictEqual(indices.sort(), [0, 1, 2, 3, 4]);
        });
    });

    suite('Progress Tracking', () => {
        test('should call onProgress callback', async () => {
            const items = [1, 2, 3, 4, 5];
            const progressUpdates: Array<{ completed: number; total: number }> = [];
            
            const results = await ParallelProcessor.processWithConcurrencyAndIndex(
                items,
                async (item) => item * 2,
                2,
                (completed, total) => {
                    progressUpdates.push({ completed, total });
                }
            );
            
            assert.deepStrictEqual(results, [2, 4, 6, 8, 10]);
            assert.strictEqual(progressUpdates.length, 5);
            assert.strictEqual(progressUpdates[progressUpdates.length - 1].completed, 5);
            assert.strictEqual(progressUpdates[progressUpdates.length - 1].total, 5);
        });

        test('should report progress accurately', async () => {
            const items = [1, 2, 3];
            const progressUpdates: number[] = [];
            
            await ParallelProcessor.processWithConcurrencyAndIndex(
                items,
                async (item) => {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    return item;
                },
                1,
                (completed) => {
                    progressUpdates.push(completed);
                }
            );
            
            assert.deepStrictEqual(progressUpdates, [1, 2, 3]);
        });
    });

    suite('Error Handling', () => {
        test('should reject on processor error', async () => {
            const items = [1, 2, 3];
            
            try {
                await ParallelProcessor.processWithConcurrencyAndIndex(
                    items,
                    async (item) => {
                        if (item === 2) {
                            throw new Error('Processing error');
                        }
                        return item;
                    },
                    2
                );
                assert.fail('Should have thrown an error');
            } catch (error: any) {
                assert.strictEqual(error.message, 'Processing error');
            }
        });

        test('should stop processing on first error', async () => {
            const items = [1, 2, 3, 4, 5];
            const processed: number[] = [];
            
            try {
                await ParallelProcessor.processWithConcurrencyAndIndex(
                    items,
                    async (item) => {
                        processed.push(item);
                        if (item === 3) {
                            throw new Error('Stop here');
                        }
                        await new Promise(resolve => setTimeout(resolve, 10));
                        return item;
                    },
                    2
                );
            } catch (error) {
                // Expected
            }
            
            // Not all items should be processed after error
            assert.ok(processed.length < items.length);
        });
    });

    suite('Complex Data Types', () => {
        test('should handle objects', async () => {
            const items = [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
                { id: 3, name: 'Charlie' }
            ];
            
            const results = await ParallelProcessor.processWithConcurrencyAndIndex(
                items,
                async (item) => ({ ...item, processed: true }),
                2
            );
            
            assert.strictEqual(results.length, 3);
            assert.ok(results.every(r => r.processed));
        });

        test('should handle async transformations', async () => {
            const items = ['hello', 'world', 'test'];
            
            const results = await ParallelProcessor.processWithConcurrencyAndIndex(
                items,
                async (item) => {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    return item.toUpperCase();
                },
                2
            );
            
            assert.deepStrictEqual(results, ['HELLO', 'WORLD', 'TEST']);
        });
    });
});
