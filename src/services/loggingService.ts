import * as vscode from 'vscode';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    NONE = 5
}

/**
 * Centralized logging service with configurable log levels.
 * Outputs to both VS Code output channel and console for debugging.
 */
export class LoggingService {
    private static readonly CONFIG_SECTION = 'dartUnusedCode';
    private outputChannel: vscode.OutputChannel;
    private currentLogLevel: LogLevel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.currentLogLevel = this.getConfiguredLogLevel();
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(`${LoggingService.CONFIG_SECTION}.logLevel`)) {
                this.currentLogLevel = this.getConfiguredLogLevel();
                this.info('Log level changed to: ' + LogLevel[this.currentLogLevel]);
            }
        });
    }

    /**
     * Get the configured log level from VS Code settings
     */
    private getConfiguredLogLevel(): LogLevel {
        const config = vscode.workspace.getConfiguration(LoggingService.CONFIG_SECTION);
        const logLevelStr = config.get<string>('logLevel', 'INFO').toUpperCase();
        
        const level = LogLevel[logLevelStr as keyof typeof LogLevel];
        return level !== undefined ? level : LogLevel.INFO;
    }

    /**
     * Log a message at the specified level
     */
    private log(level: LogLevel, message: string, ...args: any[]): void {
        if (level < this.currentLogLevel) {
            return;
        }

        const timestamp = new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
        const levelName = LogLevel[level].padEnd(5);
        const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;
        
        // Format additional arguments
        let fullMessage = formattedMessage;
        if (args.length > 0) {
            const argsStr = args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ');
            fullMessage += ' ' + argsStr;
        }

        // Output to channel
        this.outputChannel.appendLine(fullMessage);

        // Also log to console for development/debugging
        switch (level) {
            case LogLevel.ERROR:
                console.error(fullMessage);
                break;
            case LogLevel.WARN:
                console.warn(fullMessage);
                break;
            case LogLevel.DEBUG:
            case LogLevel.TRACE:
                console.debug(fullMessage);
                break;
            default:
                console.log(fullMessage);
        }
    }

    /**
     * Log trace-level messages (most verbose, for deep debugging)
     */
    trace(message: string, ...args: any[]): void {
        this.log(LogLevel.TRACE, message, ...args);
    }

    /**
     * Log debug-level messages (detailed diagnostic information)
     */
    debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    /**
     * Log info-level messages (general informational messages)
     */
    info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    /**
     * Log warning messages (potentially problematic situations)
     */
    warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    /**
     * Log error messages (serious issues)
     */
    error(message: string, error?: Error | any, ...args: any[]): void {
        if (error instanceof Error) {
            this.log(LogLevel.ERROR, `${message}: ${error.message}`, error.stack, ...args);
        } else if (error) {
            this.log(LogLevel.ERROR, message, error, ...args);
        } else {
            this.log(LogLevel.ERROR, message, ...args);
        }
    }

    /**
     * Check if a log level is enabled
     */
    isLevelEnabled(level: LogLevel): boolean {
        return level >= this.currentLogLevel;
    }

    /**
     * Create a child logger with a prefix for better context
     */
    createChild(prefix: string): ChildLogger {
        return new ChildLogger(this, prefix);
    }

    /**
     * Show the output channel
     */
    show(): void {
        this.outputChannel.show();
    }

    /**
     * Clear the output channel
     */
    clear(): void {
        this.outputChannel.clear();
    }
}

/**
 * Child logger that adds a prefix to all messages
 */
export class ChildLogger {
    constructor(
        private parent: LoggingService,
        private prefix: string
    ) {}

    private formatMessage(message: string): string {
        return `[${this.prefix}] ${message}`;
    }

    trace(message: string, ...args: any[]): void {
        this.parent.trace(this.formatMessage(message), ...args);
    }

    debug(message: string, ...args: any[]): void {
        this.parent.debug(this.formatMessage(message), ...args);
    }

    info(message: string, ...args: any[]): void {
        this.parent.info(this.formatMessage(message), ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.parent.warn(this.formatMessage(message), ...args);
    }

    error(message: string, error?: Error | any, ...args: any[]): void {
        this.parent.error(this.formatMessage(message), error, ...args);
    }

    isLevelEnabled(level: LogLevel): boolean {
        return this.parent.isLevelEnabled(level);
    }
}
