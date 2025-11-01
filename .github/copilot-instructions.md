<!-- Workspace instructions for VS Code extension development -->
✅ **COMPLETE** - VS Code Extension for Detecting Unused Dart Methods

## Project Summary
- Extension successfully scaffolded, customized, and compiled
- **Refactored with proper directory structure and separation of concerns**
- Core analyzer implements cross-file analysis using VS Code's language services
- Uses Document Symbol Provider (AST-based) and Reference Provider (Dart Analysis Server)
- VS Code integration with diagnostics, commands, and configuration
- Documentation complete with comprehensive README and ARCHITECTURE.md
- Ready for testing in Extension Development Host

## Architecture Overview

### Directory Structure
```
src/
├── analyzers/          # High-level orchestration (AnalyzerOrchestrator)
├── commands/           # Command handlers (AnalyzeWorkspace, ClearDiagnostics)
├── core/               # Core analysis logic (WorkspaceAnalyzer, IncrementalAnalyzer)
├── factories/          # Dependency injection (ServiceFactory)
├── providers/          # Event handlers (DocumentSave, FileSystem)
├── services/           # Reusable services (Configuration, FileDiscovery, etc.)
├── shared/             # Types and utilities
└── extension.ts        # Entry point
```

### Key Components
- **AnalyzerOrchestrator**: Main facade coordinating all analysis workflows
- **ServiceFactory**: Dependency injection container
- **Command Handlers**: Separate classes for each VS Code command
- **Event Providers**: React to document save and file system events
- **Core Analyzers**: Specialized analysis strategies (workspace, incremental, lifecycle)

See `src/ARCHITECTURE.md` for detailed design documentation.

## To Test
1. Press F5 to launch Extension Development Host
2. In the new window, open: `dart-unused-code/src/test/test-project`
3. Extension auto-analyzes or use: Cmd+Shift+P → "Dart: Analyze Unused Code"
4. View results in Problems panel and inline editor highlights

## Expected Test Results
The test project should detect these unused methods:
- ❌ `multiply` in example.dart (line 8) - never called
- ❌ `getFullDetails` in user.dart (line 13) - never called
- ✅ `isAdult` in user.dart should NOT be flagged (used internally by getStatus)

## Key Features
- AST-based analysis via VS Code Document Symbol Provider
- Cross-file reference checking via Reference Provider (Dart Analysis Server)
- Semantic token analysis for accurate method call detection
- Incremental analysis: re-analyzes methods on file save (same package only)
- Dependency tracking: handles removed references and file deletions
- Real-time detection on file save
- Configurable severity (Error/Warning/Information/Hint)
- Exclude patterns for generated files
- Skips private methods (already handled by dart analyze)

## VS Code API References
When working with VS Code commands and language features, always refer to:
- **Commands API**: https://code.visualstudio.com/api/references/commands
  - Comprehensive reference for all built-in commands
  - Documents request/response structures
  - Use this to verify command signatures and return types
- **Semantic Highlighting**: https://code.visualstudio.com/api/language-extensions/semantic-highlight-guide
  - Standard token types and modifiers
  - Token encoding format
  - Legend and provider patterns
