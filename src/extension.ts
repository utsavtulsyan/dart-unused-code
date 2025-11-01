import * as vscode from 'vscode';
import { ServiceFactory } from './factories/serviceFactory';
import { AnalyzeWorkspaceCommand, ClearDiagnosticsCommand, ToggleStatusBarDetailCommand } from './commands';
import { DocumentSaveProvider, FileSystemProvider } from './providers';
import { LoggingService } from './services/loggingService';

/**
 * Extension entry point.
 * Coordinates setup and teardown of the extension.
 */
export function activate(context: vscode.ExtensionContext) {
    // Create VS Code resources
    const outputChannel = vscode.window.createOutputChannel('Dart Unused Code');
    context.subscriptions.push(outputChannel);

    // Initialize logging service first
    const loggingService = new LoggingService(outputChannel);
    loggingService.info('Dart Unused Code extension is now active');

    // Check for Required Dart extension
    const dartExtension = vscode.extensions.getExtension('dart-code.dart-code');
    if (!dartExtension) {
        loggingService.error('Dart extension (dart-code.dart-code) not found. Some features may be limited.');
    } else if (!dartExtension.isActive) {
        loggingService.info('Dart extension found, activating...');
        dartExtension.activate().then(
            () => loggingService.info('Dart extension activated successfully'),
            (err) => loggingService.warn(`Failed to activate Dart extension: ${err}`)
        );
    }

    const diagnosticCollection = vscode.languages.createDiagnosticCollection('dartUnusedCode');
    context.subscriptions.push(diagnosticCollection);

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    context.subscriptions.push(statusBarItem);

    // Initialize service container
    const serviceFactory = new ServiceFactory(
        loggingService,
        diagnosticCollection,
        statusBarItem
    );

    const orchestrator = serviceFactory.getOrchestrator();
    const diagnosticService = serviceFactory.getDiagnostics();

    // Register commands
    const analyzeCommand = new AnalyzeWorkspaceCommand(orchestrator);
    analyzeCommand.register(context);

    const clearCommand = new ClearDiagnosticsCommand(diagnosticService);
    clearCommand.register(context);

    const toggleStatusBarCommand = new ToggleStatusBarDetailCommand();
    context.subscriptions.push(
        vscode.commands.registerCommand('dartUnusedCode.toggleStatusBarDetail', () => {
            toggleStatusBarCommand.execute();
        })
    );

    // Register event providers
    const documentSaveProvider = new DocumentSaveProvider(orchestrator, loggingService);
    documentSaveProvider.register(context);

    const fileSystemProvider = new FileSystemProvider(orchestrator, loggingService);
    fileSystemProvider.register(context);

    // Run initial analysis after a delay
    const config = serviceFactory.getConfigurationService().getConfiguration();
    setTimeout(() => {
        if (vscode.workspace.workspaceFolders) {
            loggingService.debug('Starting initial workspace analysis...');
            orchestrator.analyzeWorkspace();
        }
    }, config.analysisDelay);
}

export function deactivate() {
    // Extension is deactivating - no logging needed as output channel may be disposed
}
