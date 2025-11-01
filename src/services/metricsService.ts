interface AnalysisMetrics {
    startTime: number;
    endTime?: number;
    duration?: number;
    filesAnalyzed: number;
    methodsUsed: number;
    methodsUnused: number;
    isIncremental: boolean;
}

/**
 * Service for collecting and reporting extension performance metrics.
 * Focuses on: timing (full/incremental/average), files analyzed, and changes detected (used/unused).
 */
export class MetricsService {
    private metrics: AnalysisMetrics[] = [];
    private readonly maxHistorySize = 50;
    private lastFullAnalysis?: AnalysisMetrics;
    private lastIncrementalAnalysis?: AnalysisMetrics;

    startAnalysis(isIncremental: boolean = false): AnalysisMetrics {
        const metrics: AnalysisMetrics = {
            startTime: Date.now(),
            filesAnalyzed: 0,
            methodsUsed: 0,
            methodsUnused: 0,
            isIncremental
        };
        
        this.metrics.push(metrics);
        
        // Keep only recent metrics
        if (this.metrics.length > this.maxHistorySize) {
            this.metrics = this.metrics.slice(-this.maxHistorySize);
        }
        
        return metrics;
    }

    finishAnalysis(metrics: AnalysisMetrics): void {
        metrics.endTime = Date.now();
        metrics.duration = metrics.endTime - metrics.startTime;
        
        if (metrics.isIncremental) {
            this.lastIncrementalAnalysis = metrics;
        } else {
            this.lastFullAnalysis = metrics;
        }
    }

    private formatDuration(durationMs: number): string {
        return durationMs < 1000 
            ? `${durationMs.toFixed(0)}ms`
            : `${(durationMs / 1000).toFixed(2)}s`;
    }

    getAverageFullAnalysisTime(): number {
        const fullAnalyses = this.metrics.filter(m => !m.isIncremental && m.duration !== undefined);
        
        if (fullAnalyses.length === 0) {
            return 0;
        }
        
        const totalTime = fullAnalyses.reduce((sum, m) => sum + (m.duration || 0), 0);
        return totalTime / fullAnalyses.length;
    }

    getAverageIncrementalAnalysisTime(): number {
        const incrementalAnalyses = this.metrics.filter(m => m.isIncremental && m.duration !== undefined);
        
        if (incrementalAnalyses.length === 0) {
            return 0;
        }
        
        const totalTime = incrementalAnalyses.reduce((sum, m) => sum + (m.duration || 0), 0);
        return totalTime / incrementalAnalyses.length;
    }

    getPerformanceReport(): string {
        const parts: string[] = [];

        // Average full analysis timing
        const avgFullTimeMs = this.getAverageFullAnalysisTime();
        if (avgFullTimeMs > 0) {
            parts.push(`Avg Full: ${this.formatDuration(avgFullTimeMs)}`);
        }

        // Average incremental analysis timing
        const avgIncrTimeMs = this.getAverageIncrementalAnalysisTime();
        if (avgIncrTimeMs > 0) {
            parts.push(`Avg Incremental: ${this.formatDuration(avgIncrTimeMs)}`);
        }

        // Last full analysis
        if (this.lastFullAnalysis?.duration !== undefined) {
            const fa = this.lastFullAnalysis;
            parts.push(
                `Last Full: ${this.formatDuration(fa.duration!)} ` +
                `(${fa.filesAnalyzed} files, ${fa.methodsUnused} unused/${fa.methodsUsed + fa.methodsUnused} methods)`
            );
        }

        // Last incremental analysis
        if (this.lastIncrementalAnalysis?.duration !== undefined) {
            const ia = this.lastIncrementalAnalysis;
            parts.push(
                `Last Incremental: ${this.formatDuration(ia.duration!)} ` +
                `(${ia.filesAnalyzed} files, ${ia.methodsUnused} unused/${ia.methodsUsed + ia.methodsUnused} methods)`
            );
        }

        return parts.length > 0 ? `[METRICS] ${parts.join(' | ')}` : '[METRICS] No data yet';
    }
}