# Dart Unused Code

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/utsavtulsyan.dart-unused-code?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=utsavtulsyan.dart-unused-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

Detects unused public methods in Dart projects with cross-file analysis.

Dart's analyzer detects unused private methods (`_method`) but not public ones. This extension finds unused public methods across your workspace.

## Features

- Cross-file unused method detection
- Real-time analysis on file save
- Configurable severity levels and exclusions
- Automatic exclusion of generated files (`.g.dart`, `.freezed.dart`, etc.)
- Status bar integration

**Note:** Classes, getters, and setters detection planned for future releases

## Requirements

- [Dart extension](https://marketplace.visualstudio.com/items?itemName=Dart-Code.dart-code)

## Usage

1. Open a Dart project
2. Analysis runs automatically after initial delay
3. Save a `.dart` file to trigger analysis
4. View results in Problems panel (`Cmd+Shift+M` / `Ctrl+Shift+M`)

Manual analysis: `Cmd+Shift+P` → `Dart: Analyze Unused Code`

## Commands

| Command | Description |
|---------|-------------|
| `Dart: Analyze Unused Code` | Analyze entire workspace |
| `Dart: Clear Unused Code Warnings` | Clear all diagnostics |
| `Dart: Toggle Status Bar Detail` | Toggle status bar view |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `dartUnusedCode.enabled` | `true` | Enable/disable extension |
| `dartUnusedCode.severity` | `Warning` | Diagnostic severity (`Error`, `Warning`, `Information`, `Hint`) |
| `dartUnusedCode.sourceDirectory` | `lib` | Directory to analyze |
| `dartUnusedCode.analyzeOnSave` | `true` | Analyze on file save |
| `dartUnusedCode.analysisDelay` | `2000` | Initial analysis delay (ms) |
| `dartUnusedCode.excludePatterns` | See below | File exclusion patterns |
| `dartUnusedCode.logLevel` | `INFO` | Log level (`TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `NONE`) |

### Default Exclusions

- Generated files: `*.g.dart`, `*.freezed.dart`, `*.gr.dart`, `*.config.dart`, `*.mocks.dart`
- Test files: `test/**`, `*_test.dart`, `tests/**`
- Build artifacts: `.dart_tool/**`, `build/**`, `generated/**`

### Example

```json
{
  "dartUnusedCode.severity": "Information",
  "dartUnusedCode.analysisDelay": 3000
}
```

## How It Works

Uses VS Code's Document Symbol Provider and Dart Analysis Server to:
1. Extract method declarations via AST analysis
2. Find references across workspace
3. Report methods with zero references

Analysis is incremental—only changed files are re-analyzed on save.

## Troubleshooting

**False positives after opening project?**

Occurs when analysis runs before Dart Analysis Server completes indexing.

Solutions:
- Wait for initial indexing, then re-run analysis
- Increase `dartUnusedCode.analysisDelay` to `3000`-`5000`
- Wait for status bar "Analyzing..." to complete

**Logs:** `View` → `Output` → `Dart Unused Code`

## Limitations

- Methods only (classes, getters, setters planned)
- May not detect reflection, `dynamic` calls, or `noSuchMethod` usage
- Requires Dart Analysis Server readiness

## Issues & Contributions

- [Report bugs](https://github.com/utsavtulsyan/dart-unused-code/issues/new?template=bug_report.md)
- [Request features](https://github.com/utsavtulsyan/dart-unused-code/issues/new?template=feature_request.md)
- [Contributing guidelines](https://github.com/utsavtulsyan/dart-unused-code/blob/main/CONTRIBUTING.md)
