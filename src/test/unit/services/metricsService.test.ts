import * as assert from 'assert';
import { MetricsService } from '../../../services/metricsService';

suite('MetricsService Unit Tests', () => {
    let metricsService: MetricsService;

    setup(() => {
        metricsService = new MetricsService();
    });

    suite('Basic Analysis Tracking', () => {
        test('should start and finish full analysis', () => {
            const metrics = metricsService.startAnalysis(false);
            assert.strictEqual(metrics.isIncremental, false);
            assert.strictEqual(metrics.filesAnalyzed, 0);
            assert.ok(metrics.startTime > 0);
            assert.strictEqual(metrics.endTime, undefined);

            metrics.filesAnalyzed = 10;
            metrics.methodsUsed = 50;
            metrics.methodsUnused = 5;

            metricsService.finishAnalysis(metrics);
            assert.ok(metrics.endTime! > 0);
            assert.ok(metrics.duration! >= 0);
        });

        test('should start and finish incremental analysis', () => {
            const metrics = metricsService.startAnalysis(true);
            assert.strictEqual(metrics.isIncremental, true);

            metricsService.finishAnalysis(metrics);
            assert.ok(metrics.duration! >= 0);
        });

        test('should default to non-incremental', () => {
            const metrics = metricsService.startAnalysis();
            assert.strictEqual(metrics.isIncremental, false);
        });
    });

    suite('Average Time Calculations', () => {
        test('should calculate average full analysis time', () => {
            // Run multiple analyses
            for (let i = 0; i < 3; i++) {
                const metrics = metricsService.startAnalysis(false);
                // Manually set duration since we can't wait for real time
                metrics.startTime = Date.now() - (100 + i * 50);
                metricsService.finishAnalysis(metrics);
            }

            const avgTime = metricsService.getAverageFullAnalysisTime();
            assert.strictEqual(avgTime, 150); // (100 + 150 + 200) / 3
        });

        test('should calculate average incremental analysis time', () => {
            // Run multiple incremental analyses
            for (let i = 0; i < 3; i++) {
                const metrics = metricsService.startAnalysis(true);
                metrics.startTime = Date.now() - (10 + i * 5);
                metricsService.finishAnalysis(metrics);
            }

            const avgTime = metricsService.getAverageIncrementalAnalysisTime();
            assert.strictEqual(avgTime, 15); // (10 + 15 + 20) / 3
        });

        test('should return 0 for average when no analyses completed', () => {
            assert.strictEqual(metricsService.getAverageFullAnalysisTime(), 0);
            assert.strictEqual(metricsService.getAverageIncrementalAnalysisTime(), 0);
        });

        test('should not include incomplete analyses in average', () => {
            const metrics1 = metricsService.startAnalysis(false);
            metricsService.finishAnalysis(metrics1);
            metrics1.duration = 100;

            const metrics2 = metricsService.startAnalysis(false);
            // Don't finish metrics2

            const avgTime = metricsService.getAverageFullAnalysisTime();
            assert.strictEqual(avgTime, 100); // Only completed analysis
        });
    });

    suite('Performance Reports', () => {
        test('should generate empty report when no data', () => {
            const report = metricsService.getPerformanceReport();
            assert.ok(report.includes('No data yet'));
        });

        test('should include full analysis in report', () => {
            const metrics = metricsService.startAnalysis(false);
            metrics.filesAnalyzed = 10;
            metrics.methodsUsed = 45;
            metrics.methodsUnused = 5;
            metricsService.finishAnalysis(metrics);

            const report = metricsService.getPerformanceReport();
            assert.ok(report.includes('Last Full'));
            assert.ok(report.includes('10 files'));
            assert.ok(report.includes('5 unused'));
        });

        test('should include incremental analysis in report', () => {
            const metrics = metricsService.startAnalysis(true);
            metrics.filesAnalyzed = 1;
            metrics.methodsUsed = 10;
            metrics.methodsUnused = 2;
            metricsService.finishAnalysis(metrics);

            const report = metricsService.getPerformanceReport();
            assert.ok(report.includes('Last Incremental'));
            assert.ok(report.includes('1 files'));
        });

        test('should include averages in report', () => {
            // Add multiple analyses so averages show up
            for (let i = 0; i < 3; i++) {
                const metrics = metricsService.startAnalysis(false);
                metrics.filesAnalyzed = 10;
                metrics.startTime = Date.now() - 100;
                metricsService.finishAnalysis(metrics);
            }

            const report = metricsService.getPerformanceReport();
            assert.ok(report.includes('Avg Full'), 'Report should include average full analysis time');
        });

        test('should format durations correctly', () => {
            const metrics = metricsService.startAnalysis(false);
            metrics.filesAnalyzed = 10;
            // Set duration to less than 1 second
            const startTime = Date.now();
            metrics.startTime = startTime - 500;
            metricsService.finishAnalysis(metrics);

            let report = metricsService.getPerformanceReport();
            assert.ok(report.match(/\d+ms/)); // Should show milliseconds

            // Test duration over 1 second
            const metrics2 = metricsService.startAnalysis(false);
            metrics2.filesAnalyzed = 10;
            metrics2.startTime = startTime - 2500;
            metricsService.finishAnalysis(metrics2);

            report = metricsService.getPerformanceReport();
            assert.ok(report.match(/\d+\.\d+s/)); // Should show seconds
        });
    });

    suite('History Management', () => {
        test('should maintain limited history', () => {
            // Create more than maxHistorySize analyses
            for (let i = 0; i < 60; i++) {
                const metrics = metricsService.startAnalysis(false);
                metricsService.finishAnalysis(metrics);
            }

            // Can't directly test private metrics array, but we can verify
            // that average calculations still work
            const avgTime = metricsService.getAverageFullAnalysisTime();
            assert.ok(avgTime >= 0);
        });

        test('should track both full and incremental separately', () => {
            const fullMetrics = metricsService.startAnalysis(false);
            fullMetrics.startTime = Date.now() - 1000;
            metricsService.finishAnalysis(fullMetrics);

            const incrMetrics = metricsService.startAnalysis(true);
            incrMetrics.startTime = Date.now() - 50;
            metricsService.finishAnalysis(incrMetrics);

            assert.strictEqual(metricsService.getAverageFullAnalysisTime(), 1000);
            assert.strictEqual(metricsService.getAverageIncrementalAnalysisTime(), 50);
        });
    });

    suite('Edge Cases', () => {
        test('should handle zero duration', () => {
            const metrics = metricsService.startAnalysis(false);
            metrics.filesAnalyzed = 0;
            metricsService.finishAnalysis(metrics);

            assert.ok(metrics.duration !== undefined);
            assert.ok(metrics.duration >= 0);
        });

        test('should handle multiple concurrent tracking', () => {
            const metrics1 = metricsService.startAnalysis(false);
            const metrics2 = metricsService.startAnalysis(true);

            metricsService.finishAnalysis(metrics1);
            metricsService.finishAnalysis(metrics2);

            assert.ok(metrics1.duration! >= 0);
            assert.ok(metrics2.duration! >= 0);
        });

        test('should preserve metrics data', () => {
            const metrics = metricsService.startAnalysis(false);
            metrics.filesAnalyzed = 42;
            metrics.methodsUsed = 100;
            metrics.methodsUnused = 5;

            metricsService.finishAnalysis(metrics);

            assert.strictEqual(metrics.filesAnalyzed, 42);
            assert.strictEqual(metrics.methodsUsed, 100);
            assert.strictEqual(metrics.methodsUnused, 5);
        });
    });
});
