import * as vscode from 'vscode';
import {
    ConfigurationService,
    MetricsService,
    CacheService,
    DependencyTrackerService,
    LoggingService,
} from '../services';
import {
    MethodAnalyzer,
    MethodExtractor,
    ReferenceAnalyzer,
    DependencyDiscovery,
} from '../core';
import {
    AnalyzerOrchestrator,
    AnalysisQueue,
    AnalysisExecutor,
    FileAnalysisHandler,
    WorkspaceAnalyzer,
} from '../analyzers';
import { VscodeCommands, Diagnostics, StatusBar } from '../infra';

/**
 * Service container for dependency injection.
 * Centralizes creation and wiring of all services and components.
 * 
 * Single Responsibility: Manage object graph construction and lifecycle.
 */
export class ServiceFactory {
    // Services (stateless or configuration)
    private readonly configService: ConfigurationService;
    private readonly diagnostics: Diagnostics;
    private readonly metrics: MetricsService;
    private readonly cache: CacheService;
    private readonly dependencyTracker: DependencyTrackerService;

    // Core analyzers
    private readonly methodExtractor: MethodExtractor;
    private readonly referenceAnalyzer: ReferenceAnalyzer;
    private readonly methodAnalyzer: MethodAnalyzer;
    private readonly dependencyDiscovery: DependencyDiscovery;

    // Analysis components
    private readonly analysisQueue: AnalysisQueue;
    private readonly analysisExecutor: AnalysisExecutor;
    private readonly fileAnalysisHandler: FileAnalysisHandler;

    // Main orchestrator
    private readonly orchestrator: AnalyzerOrchestrator;

    constructor(
        loggingService: LoggingService,
        diagnosticCollection: vscode.DiagnosticCollection,
        statusBarItem: vscode.StatusBarItem
    ) {
        // Initialize infrastructure services
        const vscodeCommands = new VscodeCommands();

        // Initialize services
        this.configService = new ConfigurationService();
        this.diagnostics = new Diagnostics(diagnosticCollection);
        this.metrics = new MetricsService();
        this.cache = new CacheService(loggingService.createChild('Cache'));
        this.dependencyTracker = new DependencyTrackerService(
            loggingService.createChild('DepTracker')
        );

        // Initialize core analyzers
        const config = this.configService.getConfiguration();
        this.methodExtractor = new MethodExtractor(
            vscodeCommands,
            loggingService.createChild('MethodExtractor')
        );
        this.referenceAnalyzer = new ReferenceAnalyzer(
            vscodeCommands,
            loggingService.createChild('RefAnalyzer')
        );
        this.dependencyDiscovery = new DependencyDiscovery(
            loggingService.createChild('DepDiscovery'),
            config.sourceDirectory
        );
        this.configService.onDidChangeConfiguration(updatedConfig => {
            this.dependencyDiscovery.updateSourceDirectory(updatedConfig.sourceDirectory);
        });
        this.methodAnalyzer = new MethodAnalyzer(
            this.methodExtractor,
            this.referenceAnalyzer,
            this.diagnostics,
            loggingService.createChild('MethodAnalyzer')
        );

        // Initialize analysis queue and executor
        this.analysisQueue = new AnalysisQueue(loggingService.createChild('AnalysisQueue'));

        this.analysisExecutor = new AnalysisExecutor(
            this.methodExtractor,
            this.referenceAnalyzer,
            this.diagnostics,
            this.cache,
            this.dependencyTracker,
            this.dependencyDiscovery,
            loggingService.createChild('AnalysisExecutor')
        );

        // Initialize file analysis handler
        this.fileAnalysisHandler = new FileAnalysisHandler(
            this.analysisQueue,
            vscodeCommands,
            this.cache,
            this.diagnostics,
            loggingService.createChild('FileAnalysis')
        );

        // Initialize orchestrator
        StatusBar.initialize(statusBarItem);
        this.orchestrator = new AnalyzerOrchestrator(
            this.analysisQueue,
            this.analysisExecutor,
            this.fileAnalysisHandler,
            this.configService,
            this.diagnostics,
            this.cache,
            loggingService.createChild('Orchestrator')
        );
    }

    /**
     * Gets the main analyzer orchestrator.
     */
    getOrchestrator(): AnalyzerOrchestrator {
        return this.orchestrator;
    }

    /**
     * Gets the diagnostic service.
     */
    getDiagnostics(): Diagnostics {
        return this.diagnostics;
    }

    /**
     * Gets the configuration service.
     */
    getConfigurationService(): ConfigurationService {
        return this.configService;
    }
}
