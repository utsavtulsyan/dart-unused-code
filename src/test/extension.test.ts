import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * Legacy test file - main tests are in unit/ and integration/ directories.
 * This file remains for backwards compatibility with the test runner.
 */
suite('Extension Basic Tests', () => {
	test('VS Code API should be available', () => {
		assert.ok(vscode, 'VS Code API should be available');
		assert.ok(vscode.window, 'VS Code window API should be available');
		assert.ok(vscode.commands, 'VS Code commands API should be available');
	});

	test('Extension should be present', () => {
		const ext = vscode.extensions.getExtension('utsavtulsyan.dart-unused-code');
		assert.ok(ext, 'Extension should be found');
	});
});
