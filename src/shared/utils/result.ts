/**
 * Result pattern for better error handling and composability
 */
export type Result<T, E = Error> = 
    | { success: true; data: T }
    | { success: false; error: E };

export class ResultUtils {
    static ok<T>(data: T): Result<T, never> {
        return { success: true, data };
    }

    static error<E>(error: E): Result<never, E> {
        return { success: false, error };
    }

    static async fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
        try {
            const data = await promise;
            return ResultUtils.ok(data);
        } catch (error) {
            return ResultUtils.error(error instanceof Error ? error : new Error(String(error)));
        }
    }

    static map<T, U, E>(
        result: Result<T, E>, 
        fn: (data: T) => U
    ): Result<U, E> {
        return result.success ? ResultUtils.ok(fn(result.data)) : result;
    }

    static flatMap<T, U, E>(
        result: Result<T, E>, 
        fn: (data: T) => Result<U, E>
    ): Result<U, E> {
        return result.success ? fn(result.data) : result;
    }
}