# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/) | Versioning: [Semantic Versioning](https://semver.org/)

## [1.1.0] (Prerelease) & [1.2.0] (Release) - 2025-11-18

### Added
- Queued analysis for increased responsiveness and stability

## [1.0.1] - 2025-11-01

### Changed
- Updated default exclusion patterns to skip common generated file patterns
- Optimized extension icon for better compatibility
- Improved CI/CD workflows with integrated version bump and release process

## [1.0.0] - 2025-10-31

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
