# Dart Unused Code

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/utsavtulsyan.dart-unused-code?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=utsavtulsyan.dart-unused-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

Detects unused code in Dart projects with cross-file analysis.

## Features

- Detects unused public methods across files
- Real-time analysis on file save
- Configurable
- Smart exclusions for generated files
- Status bar live updates

**Coming soon:** Unused classes detection

## Why?

Dart's analyzer only detects unused **private** methods (prefixed with `_`). This extension finds unused **public** methods within your workspace.

## Requirements

[Dart extension](https://marketplace.visualstudio.com/items?itemName=Dart-Code.dart-code)

## Configuration

Key settings:

* `dartUnusedCode.enabled` - Enable/disable (default: `true`)
* `dartUnusedCode.sourceDirectory` - Directory to analyze (default: `"lib"`)
* `dartUnusedCode.severity` - `Error`, `Warning`, `Information`, or `Hint` (default: `Warning`)
* `dartUnusedCode.excludePatterns` - Files to exclude (default: generated files, tests)
* `dartUnusedCode.analyzeOnSave` - Auto-analyze on save (default: `true`)
* `dartUnusedCode.analysisDelay` - Delay in ms before initial analysis (default: `2000`)

## Commands

Access commands via `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux):

| Command | Description |
|---------|-------------|
| **Dart: Analyze Unused Code** | Manually trigger analysis of the entire workspace |
| **Dart: Clear Unused Code Warnings** | Clear all diagnostic markers |
| **Dart: Toggle Status Bar Detail** | Switch between compact and detailed status bar view |

## Configuration Example

```json
{
  "dartUnusedCode.enabled": true,
  "dartUnusedCode.sourceDirectory": "lib",
  "dartUnusedCode.severity": "Warning",
  "dartUnusedCode.maxConcurrency": 10,
  "dartUnusedCode.logLevel": "INFO",
  "dartUnusedCode.analyzeOnSave": true,
  "dartUnusedCode.analysisDelay": 2000,
  "dartUnusedCode.excludePatterns": [
    "**/*.g.dart",
    "**/*.freezed.dart",
    "**/*.gr.dart",
    "**/*.config.dart",
    "**/*.mocks.dart",
    "**/test/**",
    "**/tests/**",
    "**/*_test.dart",
    "**/*_tests.dart",
    "**/generated/**",
    "**/.dart_tool/**",
    "**/build/**"
  ]
}
```

## Logging

The extension provides configurable logging to help diagnose issues:

| Level | Description | Use Case |
|-------|-------------|----------|
| `TRACE` | Most verbose with execution traces | Deep debugging |
| `DEBUG` | Detailed diagnostic information | Troubleshooting |
| `INFO` | General operational messages | Normal use (default) |
| `WARN` | Potentially problematic situations | Minimal noise |
| `ERROR` | Serious issues only | Production |
| `NONE` | Disable all logging | Performance-critical |

View logs in the **Dart Unused Code** output channel (`View` → `Output` → `Dart Unused Code`).

## Known Issues

**False positives may occur if analysis runs before the Dart Analysis Server completes workspace indexing** - re-run analysis manually, wait for initial indexing to complete, or increase the `dartUnusedCode.analysisDelay` setting (default: 2000ms).


**Enjoy cleaner Dart code!** ⭐
