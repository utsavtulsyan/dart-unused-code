# Contributing

Contributions welcome! Follow these guidelines for smooth collaboration.

## Getting Started

```bash
git clone https://github.com/utsavtulsyan/dart-unused-code.git
cd dart-unused-code
npm install && npm run compile
```

Test: Press `F5` in VS Code to launch Extension Development Host

## Submitting Changes

1. **Fork** and create a feature branch
2. **Make changes** following code style below
3. **Test**: `npm test && npm run lint`
4. **Document**: Update README.md and CHANGELOG.md
5. **Submit PR** using the template

## Code Guidelines

- Follow existing TypeScript patterns
- Run `npm run lint` before committing
- Keep functions focused and small
- Add JSDoc for public APIs only

## Commit Format

```
Add unused class detection
Fix Windows path resolution
Update configuration defaults
```

- Present tense, imperative ("Add" not "Added")
- Reference issues: `Fix #123`
- First line ≤50 chars

## Testing

```bash
npm test                      # All tests
npm run test:unit             # Unit only
npm run test:integration      # Integration only
```

## Reporting Issues

Use issue templates. Include:
- VS Code and Dart SDK versions
- Clear reproduction steps
- Code samples if applicable

---

Questions? [Open an issue](https://github.com/utsavtulsyan/dart-unused-code/issues)
