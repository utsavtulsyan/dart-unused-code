# Dart Unused Code Extension - AI Instructions

> **Focus**: VS Code extension fundamentals that remain stable across feature changes. This extension currently uses `dart-code.dart-code` as a dependency but aims to become IDE-independent with CLI tool support in the future.

## Architecture Pattern

**Dependency Injection via ServiceFactory**
```typescript
// ✅ CORRECT: All components receive dependencies via constructor
class MyComponent {
  constructor(
    private readonly service: SomeService,
    private readonly logger: Logger
  ) {}
}

// ❌ WRONG: Never instantiate directly
const service = new SomeService(); // Breaks testability & coupling
```

**Layered Dependency Flow**:
```
extension.ts → ServiceFactory → Orchestrator → Domain Handlers → Core Services
```

**Note**: Keep core analysis logic separate from VS Code APIs to enable future CLI/multi-IDE support.

## VS Code Extension Patterns

### 1. Extension Lifecycle
```typescript
// extension.ts activation - triggered by onLanguage:dart
export function activate(context: ExtensionContext) {
  // 1. Create disposable resources (OutputChannel, DiagnosticCollection, StatusBarItem)
  // 2. Initialize ServiceFactory with resources
  // 3. Register commands, providers
  // 4. Push all disposables to context.subscriptions
}

export function deactivate() {
  // VS Code auto-disposes context.subscriptions
}
```

### 2. Command Registration
```typescript
// Commands expose extension functionality to Command Palette
context.subscriptions.push(
  vscode.commands.registerCommand('extension.commandId', () => {
    // Command handler
  })
);
```
Configure in `package.json` → `contributes.commands` for UI visibility.

### 3. Event Providers
```typescript
// Subscribe to VS Code events for reactive behavior
vscode.workspace.onDidSaveTextDocument((doc) => {
  // Trigger incremental analysis
});

vscode.workspace.onDidCreateFiles((event) => {
  // Handle new files
});
```

### 4. DiagnosticCollection
```typescript
// Report problems to Problems panel
const diagnostics = vscode.languages.createDiagnosticCollection('extensionId');

// Set diagnostics for a file
diagnostics.set(uri, [
  new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning)
]);

// Clear diagnostics
diagnostics.clear(); // or diagnostics.delete(uri);
```

## Core Development Patterns

### Configuration Management
```typescript
// Read extension settings
const config = vscode.workspace.getConfiguration('extensionPrefix');
const value = config.get<Type>('settingName', defaultValue);

// React to configuration changes
vscode.workspace.onDidChangeConfiguration((event) => {
  if (event.affectsConfiguration('extensionPrefix.settingName')) {
    // Update behavior
  }
});
```

### File System Operations
```typescript
// Use VS Code's FileSystem API for cross-platform compatibility
await vscode.workspace.fs.readFile(uri);
await vscode.workspace.fs.writeFile(uri, content);

// Use glob patterns for file discovery
const files = await vscode.workspace.findFiles('**/*.dart', '**/node_modules/**');
```

## Testing in VS Code Extensions

### Unit Tests (Fast, Isolated)
```typescript
// Mock VS Code APIs in test setup
import * as vscode from 'vscode'; // Actually mocked version

// Test business logic without real VS Code
describe('ServiceName', () => {
  it('should handle edge case', () => {
    // Test with mocked dependencies
  });
});
```

### Integration Tests (Real VS Code)
```typescript
// Run in Extension Development Host with real APIs
suite('Integration Tests', () => {
  suiteSetup(async () => {
    // Activate extension, wait for dependencies
    const ext = vscode.extensions.getExtension('publisher.extensionId');
    await ext?.activate();
  });

  test('Command execution', async () => {
    await vscode.commands.executeCommand('extension.command');
    // Assert side effects
  });
});
```

Configure via `.vscode-test.mjs` for separate test suites with different timeouts/dependencies.

## Development Workflow

```bash
# Build & watch
npm run watch          # Auto-compiles TypeScript & bundles (tsc + esbuild)
F5                     # Launch Extension Development Host
Ctrl+Shift+F5          # Reload Extension Development Host

# Testing
npm run compile-tests  # Compile test files (required after test changes)
npm test               # All tests (auto-compiles tests via pretest)
npm run test:unit      # Unit only (fast, requires compile-tests first)
npm run test:integration # Integration (requires dependencies)

# Important: After modifying test files, always run:
# npm run compile-tests && npm run test:unit
```

## Essential VS Code API References

- **Commands**: https://code.visualstudio.com/api/references/commands
- **Extension Guides**: https://code.visualstudio.com/api/extension-guides/overview  
- **Activation Events**: https://code.visualstudio.com/api/references/activation-events
- **Contribution Points**: https://code.visualstudio.com/api/references/contribution-points
- **VS Code API**: https://code.visualstudio.com/api/references/vscode-api

## Extension Dependencies

### dart-code Extension
This extension currently depends on `dart-code.dart-code` (Dart language support):
- Declared in `package.json` → `extensionDependencies: ["dart-code.dart-code"]`
- Provides Dart Analysis Server integration
- Check for activation: `vscode.extensions.getExtension('dart-code.dart-code')`

**Future Direction**: Isolate core analysis logic from VS Code/dart-code APIs to enable:
- CLI tool (no IDE required)
- Support for other IDEs (IntelliJ, Android Studio)
- Direct Dart Analysis Server integration without dart-code dependency

## Common VS Code Extension Pitfalls

1. **Memory Leaks**: Always push disposables to `context.subscriptions[]`
2. **Activation Performance**: Use specific activation events (not `*`), defer heavy work
3. **Configuration Reads**: Cache configuration values, react to `onDidChangeConfiguration`
4. **File System**: Use `vscode.workspace.fs` instead of Node's `fs` for cross-platform support
5. **Error Handling**: Show user-friendly messages via `vscode.window.showErrorMessage()`
6. **Extension Dependencies**: Check if required extensions are installed/activated before using their APIs

## Project Structure

```
src/
  extension.ts              # Entry point (activate/deactivate)
  factories/
    serviceFactory.ts       # Dependency injection container
  commands/                 # Command handlers (registered in extension.ts)
  providers/                # Event providers (onDidSave, onDidCreate, etc.)
  core/                     # Domain logic (method analysis, reference checking)
  services/                 # Shared services (config, cache, logging)
  infra/                    # VS Code API wrappers (diagnostics, status bar)
  shared/
    types.ts                # TypeScript interfaces
    utils/                  # Pure utility functions
  test/
    unit/                   # Fast tests with mocked VS Code APIs
    integration/            # Real VS Code tests with dart-code dependency
```

## When Adding Features

1. Define configuration in `package.json` → `contributes.configuration`
2. Add types to `src/shared/types.ts`
3. Update `ConfigurationService` to read settings
4. Wire new dependencies via `ServiceFactory`
5. Write unit tests first, then validate with integration tests
6. Document in README.md, update CHANGELOG.md
