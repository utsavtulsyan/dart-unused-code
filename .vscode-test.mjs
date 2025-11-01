import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	tests: [
		{
			label: 'unitTests',
			files: 'out/test/unit/**/*.test.js',
			workspaceFolder: './src/test/test-project',
			extensionDevelopmentPath: '.',
			extensionTestsEnv: { DART_CODE_EXTENSION: 'true' },
			installExtensions: ['dart-code.dart-code'],
			launchArgs: [
				'--skip-welcome',
				'--skip-release-notes',
				'--disable-workspace-trust'
			],
			mocha: {
				ui: 'tdd',
				timeout: 20000,
				color: true
			}
		},
		{
			label: 'integrationTests',
			files: 'out/test/integration/**/*.test.js',
			workspaceFolder: './src/test/test-project',
			extensionDevelopmentPath: '.',
			extensionTestsEnv: { DART_CODE_EXTENSION: 'true' },
			installExtensions: ['dart-code.dart-code'],
			launchArgs: [
				'--skip-welcome',
				'--skip-release-notes',
				'--disable-workspace-trust'
			],
			mocha: {
				ui: 'tdd',
				timeout: 60000,
				color: true,
				slow: 10000
			}
		}
	]
});
