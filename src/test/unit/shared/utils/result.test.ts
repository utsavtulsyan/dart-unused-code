import * as assert from 'assert';
import { Result, ResultUtils } from '../../../../shared/utils/result';

suite('Result Pattern Unit Tests', () => {
    suite('Creation', () => {
        test('should create success result', () => {
            const result = ResultUtils.ok(42);
            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.strictEqual(result.data, 42);
            }
        });

        test('should create error result', () => {
            const error = new Error('Test error');
            const result = ResultUtils.error(error);
            assert.strictEqual(result.success, false);
            if (!result.success) {
                assert.strictEqual(result.error, error);
            }
        });
    });

    suite('Promise Conversion', () => {
        test('should convert successful promise', async () => {
            const promise = Promise.resolve(42);
            const result = await ResultUtils.fromPromise(promise);
            
            assert.strictEqual(result.success, true);
            if (result.success) {
                assert.strictEqual(result.data, 42);
            }
        });

        test('should convert rejected promise', async () => {
            const promise = Promise.reject(new Error('Test error'));
            const result = await ResultUtils.fromPromise(promise);
            
            assert.strictEqual(result.success, false);
            if (!result.success) {
                assert.ok(result.error instanceof Error);
                assert.strictEqual(result.error.message, 'Test error');
            }
        });

        test('should convert non-Error rejection to Error', async () => {
            const promise = Promise.reject('String error');
            const result = await ResultUtils.fromPromise(promise);
            
            assert.strictEqual(result.success, false);
            if (!result.success) {
                assert.ok(result.error instanceof Error);
                assert.strictEqual(result.error.message, 'String error');
            }
        });
    });

    suite('Mapping', () => {
        test('should map success result', () => {
            const result = ResultUtils.ok(5);
            const mapped = ResultUtils.map(result, x => x * 2);
            
            assert.strictEqual(mapped.success, true);
            if (mapped.success) {
                assert.strictEqual(mapped.data, 10);
            }
        });

        test('should not map error result', () => {
            const error = new Error('Test error');
            const result = ResultUtils.error(error);
            const mapped = ResultUtils.map(result, x => x * 2);
            
            assert.strictEqual(mapped.success, false);
            if (!mapped.success) {
                assert.strictEqual(mapped.error, error);
            }
        });

        test('should allow type transformation in map', () => {
            const result = ResultUtils.ok(42);
            const mapped = ResultUtils.map(result, x => `Value: ${x}`);
            
            assert.strictEqual(mapped.success, true);
            if (mapped.success) {
                assert.strictEqual(mapped.data, 'Value: 42');
            }
        });
    });

    suite('Flat Mapping', () => {
        test('should flatMap success to success', () => {
            const result = ResultUtils.ok(5);
            const flatMapped = ResultUtils.flatMap(result, x => ResultUtils.ok(x * 2));
            
            assert.strictEqual(flatMapped.success, true);
            if (flatMapped.success) {
                assert.strictEqual(flatMapped.data, 10);
            }
        });

        test('should flatMap success to error', () => {
            const result = ResultUtils.ok(5);
            const error = new Error('Validation error');
            const flatMapped = ResultUtils.flatMap(result, x => ResultUtils.error(error));
            
            assert.strictEqual(flatMapped.success, false);
            if (!flatMapped.success) {
                assert.strictEqual(flatMapped.error, error);
            }
        });

        test('should not flatMap error result', () => {
            const error = new Error('Test error');
            const result = ResultUtils.error(error);
            const flatMapped = ResultUtils.flatMap(result, x => ResultUtils.ok('Never called'));
            
            assert.strictEqual(flatMapped.success, false);
            if (!flatMapped.success) {
                assert.strictEqual(flatMapped.error, error);
            }
        });
    });

    suite('Chaining', () => {
        test('should chain operations', () => {
            const result = ResultUtils.ok(5);
            const chained = ResultUtils.flatMap(
                ResultUtils.map(result, x => x * 2),
                x => ResultUtils.ok(x + 10)
            );
            
            assert.strictEqual(chained.success, true);
            if (chained.success) {
                assert.strictEqual(chained.data, 20);
            }
        });

        test('should short-circuit on error', () => {
            const error = new Error('Initial error');
            const result = ResultUtils.error(error);
            const chained = ResultUtils.flatMap(
                ResultUtils.map(result, (x: any) => x * 2),
                x => ResultUtils.ok(x + 10)
            );
            
            assert.strictEqual(chained.success, false);
            if (!chained.success) {
                assert.strictEqual(chained.error, error);
            }
        });
    });

    suite('Type Safety', () => {
        test('should handle different data types', () => {
            const stringResult = ResultUtils.ok('hello');
            const numberResult = ResultUtils.ok(42);
            const objectResult = ResultUtils.ok({ key: 'value' });
            const arrayResult = ResultUtils.ok([1, 2, 3]);
            
            assert.strictEqual(stringResult.success, true);
            assert.strictEqual(numberResult.success, true);
            assert.strictEqual(objectResult.success, true);
            assert.strictEqual(arrayResult.success, true);
        });

        test('should handle different error types', () => {
            const errorResult = ResultUtils.error(new Error('Standard error'));
            const typeErrorResult = ResultUtils.error(new TypeError('Type error'));
            const customErrorResult = ResultUtils.error({ code: 404, message: 'Not found' });
            
            assert.strictEqual(errorResult.success, false);
            assert.strictEqual(typeErrorResult.success, false);
            assert.strictEqual(customErrorResult.success, false);
        });
    });
});
