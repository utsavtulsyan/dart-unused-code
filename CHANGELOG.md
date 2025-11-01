# Change Log

All notable changes to the "dart-unused-code" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-10-26

### Added
- Unused methods detection with cross-file analysis
- AST-based method extraction using VS Code's Document Symbol Provider
- Real-time detection on file save
- Configurable severity levels
- Exclude patterns for generated files
- Status bar integration
- Commands for manual analysis and clearing diagnostics

### Limitations
- Currently detects methods only (classes coming soon)
- May not detect reflection or dynamic calls
- Analyzes `lib/` folder only