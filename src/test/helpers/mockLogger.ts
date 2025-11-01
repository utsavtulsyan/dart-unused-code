import { Logger } from '../../shared/types';

/**
 * Creates a mock logger for testing.
 */
export function createMockLogger(): Logger {
    const logs: { level: string; message: string }[] = [];

    return {
        logs,
        trace: (message: string) => logs.push({ level: 'trace', message }),
        debug: (message: string) => logs.push({ level: 'debug', message }),
        info: (message: string) => logs.push({ level: 'info', message }),
        warn: (message: string) => logs.push({ level: 'warn', message }),
        error: (message: string) => logs.push({ level: 'error', message }),
        isLevelEnabled: (level: number) => true,
        createChild: (name: string) => createMockLogger()
    } as any as Logger;
}
