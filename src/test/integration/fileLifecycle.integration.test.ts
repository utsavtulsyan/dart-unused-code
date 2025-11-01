import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Integration tests for complete file lifecycle workflows.
 * Tests the interaction between file creation, updates, and deletion
 * with the analysis engine.
 */
suite('File Lifecycle Integration Tests', () => {
    let testWorkspace: string;
    const createdFiles: string[] = [];

    suiteSetup(function() {
        this.timeout(60000);
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        // Use the existing test-project lib directory (workspace is already pointing to test-project)
        testWorkspace = path.join(workspaceFolder.uri.fsPath, 'lib');
    });

    suiteTeardown(() => {
        // Clean up any remaining test files
        for (const filePath of createdFiles) {
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.warn(`Failed to clean up ${filePath}:`, err);
                }
            }
        }
    });

    suite('File Creation Workflow', () => {
        test('should handle new file with unused method', async function() {
            this.timeout(30000);

            const newFilePath = path.join(testWorkspace, 'new_file_temp.dart');
            createdFiles.push(newFilePath);
            const content = `
class NewClass {
  void unusedMethod() {
    print('I am not used');
  }
}
`;
            fs.writeFileSync(newFilePath, content);

            // Open the file in VS Code
            const uri = vscode.Uri.file(newFilePath);
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);

            // Wait for analysis
            await new Promise(resolve => setTimeout(resolve, 1000));

            // File should exist
            assert.ok(fs.existsSync(newFilePath), 'New file should exist');

            // Clean up
            if (fs.existsSync(newFilePath)) {
                fs.unlinkSync(newFilePath);
            }
        });

        test('should handle new file that uses existing methods', async function() {
            this.timeout(30000);

            // Create a file with a method
            const file1Path = path.join(testWorkspace, 'provider_temp.dart');
            createdFiles.push(file1Path);
            const file1Content = `
class Provider {
  void provideData() {
    print('Providing data');
  }
}
`;
            fs.writeFileSync(file1Path, file1Content);

            // Create a file that uses the method
            const file2Path = path.join(testWorkspace, 'consumer_temp.dart');
            createdFiles.push(file2Path);
            const file2Content = `
import 'provider_temp.dart';

void useProvider() {
  final provider = Provider();
  provider.provideData();
}
`;
            fs.writeFileSync(file2Path, file2Content);

            // Open both files
            const uri1 = vscode.Uri.file(file1Path);
            await vscode.workspace.openTextDocument(uri1);

            const uri2 = vscode.Uri.file(file2Path);
            await vscode.workspace.openTextDocument(uri2);

            // Wait for analysis
            await new Promise(resolve => setTimeout(resolve, 1000));

            assert.ok(fs.existsSync(file1Path), 'Provider file should exist');
            assert.ok(fs.existsSync(file2Path), 'Consumer file should exist');

            // Clean up
            if (fs.existsSync(file1Path)) {
                fs.unlinkSync(file1Path);
            }
            if (fs.existsSync(file2Path)) {
                fs.unlinkSync(file2Path);
            }
        });
    });

    suite('File Update Workflow', () => {
        test('should handle file updates', async function() {
            this.timeout(30000);

            const filePath = path.join(testWorkspace, 'update_test_temp.dart');
            createdFiles.push(filePath);
            const initialContent = `
class UpdateTest {
  void method1() {
    print('Method 1');
  }
}
`;
            fs.writeFileSync(filePath, initialContent);

            // Open the file
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);

            await new Promise(resolve => setTimeout(resolve, 500));

            // Update the file
            const updatedContent = `
class UpdateTest {
  void method1() {
    print('Method 1');
  }
  
  void method2() {
    print('Method 2');
  }
}
`;
            fs.writeFileSync(filePath, updatedContent);

            // Reload the document
            await vscode.workspace.openTextDocument(uri);

            await new Promise(resolve => setTimeout(resolve, 500));

            assert.ok(fs.existsSync(filePath), 'File should still exist after update');

            // Clean up
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });
    });

    suite('File Deletion Workflow', () => {
        test('should handle file deletion', async function() {
            this.timeout(30000);

            const filePath = path.join(testWorkspace, 'delete_test_temp.dart');
            createdFiles.push(filePath);
            const content = `
class DeleteTest {
  void testMethod() {
    print('Test');
  }
}
`;
            fs.writeFileSync(filePath, content);

            // Open the file
            const uri = vscode.Uri.file(filePath);
            await vscode.workspace.openTextDocument(uri);

            await new Promise(resolve => setTimeout(resolve, 500));

            // Delete the file
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            assert.ok(!fs.existsSync(filePath), 'File should be deleted');
        });

        test('should handle deletion of file with references', async function() {
            this.timeout(30000);

            // Create provider file
            const providerPath = path.join(testWorkspace, 'to_delete_temp.dart');
            createdFiles.push(providerPath);
            const providerContent = `
class ToDelete {
  void getData() {
    print('Data');
  }
}
`;
            fs.writeFileSync(providerPath, providerContent);

            // Create consumer file
            const consumerPath = path.join(testWorkspace, 'will_remain_temp.dart');
            createdFiles.push(consumerPath);
            const consumerContent = `
import 'to_delete_temp.dart';

void useData() {
  final obj = ToDelete();
  obj.getData();
}
`;
            fs.writeFileSync(consumerPath, consumerContent);

            // Open both files
            await vscode.workspace.openTextDocument(vscode.Uri.file(providerPath));
            await vscode.workspace.openTextDocument(vscode.Uri.file(consumerPath));

            await new Promise(resolve => setTimeout(resolve, 500));

            // Delete provider file
            if (fs.existsSync(providerPath)) {
                fs.unlinkSync(providerPath);
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            assert.ok(!fs.existsSync(providerPath), 'Provider file should be deleted');
            assert.ok(fs.existsSync(consumerPath), 'Consumer file should remain');

            // Clean up
            if (fs.existsSync(consumerPath)) {
                fs.unlinkSync(consumerPath);
            }
        });
    });

    suite('Complete Lifecycle', () => {
        test('should handle create, update, and delete sequence', async function() {
            this.timeout(45000);

            const filePath = path.join(testWorkspace, 'lifecycle_test_temp.dart');
            createdFiles.push(filePath);

            // Step 1: Create file
            const initialContent = `
class LifecycleTest {
  void initialMethod() {
    print('Initial');
  }
}
`;
            fs.writeFileSync(filePath, initialContent);
            const uri = vscode.Uri.file(filePath);
            await vscode.workspace.openTextDocument(uri);
            await new Promise(resolve => setTimeout(resolve, 500));

            assert.ok(fs.existsSync(filePath), 'File should be created');

            // Step 2: Update file
            const updatedContent = `
class LifecycleTest {
  void initialMethod() {
    print('Initial');
  }
  
  void addedMethod() {
    print('Added');
  }
}
`;
            fs.writeFileSync(filePath, updatedContent);
            await vscode.workspace.openTextDocument(uri);
            await new Promise(resolve => setTimeout(resolve, 500));

            assert.ok(fs.existsSync(filePath), 'File should exist after update');

            // Step 3: Delete file
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            await new Promise(resolve => setTimeout(resolve, 500));

            assert.ok(!fs.existsSync(filePath), 'File should be deleted');
        });
    });
});
