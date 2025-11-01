import { defineConfig } from '@vscode/test-cli';

// Use environment variable or default to minimum supported version
const vscodeVersion = process.env.VSCODE_TEST_VERSION || '1.90.0';

export default defineConfig({
	tests: [
		{
			label: 'unitTests',
			version: vscodeVersion,
			files: 'out/test/unit/**/*.test.js',
			workspaceFolder: './src/test/test-project',
			extensionDevelopmentPath: '.',
			extensionTestsEnv: { 
				DART_CODE_EXTENSION: 'true'
			},
			// No extension needed for unit tests - they use mocks
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
			version: vscodeVersion,
			files: 'out/test/integration/**/*.test.js',
			workspaceFolder: './src/test/test-project',
			extensionDevelopmentPath: '.',
			extensionTestsEnv: { 
				DART_CODE_EXTENSION: 'true'
			},
			installExtensions: ['dart-code.dart-code'],
			extensionInstallArgs: ['--force'],
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
