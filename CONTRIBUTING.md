# Contributing

Thanks for your interest in contributing!

## Reporting Issues

- Check existing issues first
- Include clear steps to reproduce
- Specify VS Code and Dart versions
- Provide code examples if relevant

## Development Setup

```bash
git clone https://github.com/utstulsy/dart-unused-code.git
cd dart-unused-code
npm install
npm run compile
```

Test: Press `F5` to launch Extension Development Host

## Pull Requests

1. Fork and create a branch
2. Add tests for new features
3. Run `npm test` and `npm run lint`
4. Update README/CHANGELOG if needed
5. Submit PR

## Code Style

- Follow existing TypeScript patterns
- Run `npm run lint` before committing
- Keep functions focused and small

3. Build the extension:
   ```bash
   npm run compile
   ```

4. Run tests:
   ```bash
   npm test
   ```

5. Launch Extension Development Host:
   - Press `F5` in VS Code
   - Or: Run → Start Debugging

## Project Structure

```
src/
├── analyzers/     # High-level orchestration
├── commands/      # Command handlers
├── core/          # Core analysis logic
├── factories/     # Dependency injection
├── providers/     # Event handlers
├── services/      # Reusable services
└── shared/        # Types and utilities
```

See `src/ARCHITECTURE.md` for detailed design documentation.

## Testing

- **Unit tests**: `npm run test:unit`
- **Integration tests**: `npm run test:integration`
- **All tests**: `npm test`
- **Watch mode**: `npm run watch-tests`

Write tests for new features and ensure existing tests pass.

## Coding Style

- Follow TypeScript best practices
- Use ESLint for linting (`npm run lint`)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Prefer composition over inheritance

## Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Reference issues and pull requests when relevant
- First line should be 50 characters or less
- Add detailed description if needed

Examples:
```
Add support for analyzing getters
Fix false positives for factory constructors
Update README with new configuration options
```

## Documentation

- Update README.md for user-facing changes
- Update CHANGELOG.md following Keep a Changelog format
- Update ARCHITECTURE.md for architectural changes
- Add inline comments for complex logic

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md with new version
3. Create a git tag: `git tag v0.1.0`
4. Push tag: `git push --tags`
5. Build package: `npm run package`
6. Publish: `vsce publish`

## Questions?

Feel free to open an issue for any questions or concerns.

Thank you for contributing! 🚀
