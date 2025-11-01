# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/) | Versioning: [Semantic Versioning](https://semver.org/)

## [0.1.0] - 2025-10-26

### Added
- Cross-file unused method detection
- AST-based analysis via Document Symbol Provider
- Real-time analysis on file save
- Configurable severity (Error/Warning/Information/Hint)
- Exclusion patterns for generated files
- Status bar with live updates
- Manual analysis command
- Configurable logging (TRACE to NONE)

### Known Limitations
- Methods only (classes planned)
- May miss reflection/dynamic calls
- Requires Dart Analysis Server readiness