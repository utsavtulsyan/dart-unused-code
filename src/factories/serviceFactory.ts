import * as vscode from 'vscode';
import {
    ConfigurationService,
    MetricsService,
    CacheService,
    DependencyTrackerService,
    LoggingService
} from '../services';
import {
    MethodAnalyzer,
    MethodExtractor,
    ReferenceAnalyzer,
    DependencyDiscovery,
    WorkspaceAnalyzer
} from '../core';
import { AnalyzerOrchestrator } from '../analyzers/analyzerOrchestrator';
import { VscodeCommands, Diagnostics, StatusBar } from '../infra';
import { FileCreationHandler, FileUpdateHandler, FileDeletionHandler, IncrementalAnalysisHandler } from '../handlers';

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
    private readonly workspaceAnalyzer: WorkspaceAnalyzer;

    // File event handlers
    private readonly fileCreationHandler: FileCreationHandler;
    private readonly fileUpdateHandler: FileUpdateHandler;
    private readonly fileDeletionHandler: FileDeletionHandler;
    private readonly incrementalAnalysisHandler: IncrementalAnalysisHandler;

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
        this.dependencyTracker = new DependencyTrackerService(loggingService.createChild('DepTracker'));

        // Initialize core analyzers
        const config = this.configService.getConfiguration();
        this.methodExtractor = new MethodExtractor(vscodeCommands, loggingService.createChild('MethodExtractor'));
        this.referenceAnalyzer = new ReferenceAnalyzer(vscodeCommands, loggingService.createChild('RefAnalyzer'));
        this.dependencyDiscovery = new DependencyDiscovery(
            loggingService.createChild('DepDiscovery'),
            config.sourceDirectory
        );
        this.configService.onDidChangeConfiguration((updatedConfig) => {
            this.dependencyDiscovery.updateSourceDirectory(updatedConfig.sourceDirectory);
        });
        this.methodAnalyzer = new MethodAnalyzer(
            this.methodExtractor,
            this.referenceAnalyzer,
            this.diagnostics,
            loggingService.createChild('MethodAnalyzer')
        );

        // Initialize specialized analyzers
        this.workspaceAnalyzer = new WorkspaceAnalyzer(
            this.methodExtractor,
            this.referenceAnalyzer,
            this.diagnostics,
            this.cache,
            this.metrics,
            this.dependencyTracker,
            this.dependencyDiscovery,
            loggingService.createChild('WorkspaceAnalyzer')
        );

        // Initialize file event handlers
        this.fileCreationHandler = new FileCreationHandler(
            vscodeCommands,
            this.cache,
            this.methodAnalyzer,
            this.dependencyTracker,
            this.dependencyDiscovery,
            this.diagnostics,
            loggingService.createChild('FileCreation')
        );

        this.fileUpdateHandler = new FileUpdateHandler(
            vscodeCommands,
            this.cache,
            this.dependencyTracker,
            this.methodAnalyzer,
            this.dependencyDiscovery,
            this.diagnostics,
            loggingService.createChild('FileUpdate')
        );

        this.fileDeletionHandler = new FileDeletionHandler(
            this.cache,
            this.methodAnalyzer,
            this.dependencyTracker,
            loggingService.createChild('FileDeletion')
        );

        // Create incremental analysis handler
        this.incrementalAnalysisHandler = new IncrementalAnalysisHandler(
            this.configService,
            this.metrics,
            this.fileUpdateHandler,
            this.fileCreationHandler,
            this.fileDeletionHandler,
            loggingService.createChild('IncrementalAnalysis')
        );

        // Initialize orchestrator
        StatusBar.initialize(statusBarItem);
        this.orchestrator = new AnalyzerOrchestrator(
            this.workspaceAnalyzer,
            this.incrementalAnalysisHandler,
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
