import * as vscode from 'vscode';
import { DartPackageUtils } from '../shared/utils/dartPackageUtils';
import { Logger } from '../shared/types';

/**
 * Fast dependency discovery using import statement parsing.
 * Optimized for finding file dependencies without analyzing every identifier.
 * 
 * This is 10-100x faster than using getDefinitions for every token because:
 * - Only parses import statements (typically 5-20 lines vs thousands of tokens)
 * - Uses simple regex matching instead of AST queries
 * - No need for Definition Provider calls
 */
export class DependencyDiscovery {
    constructor(
        private readonly logger: Logger,
        private readonly sourceDirectory: string = 'lib'
    ) {}

    /**
     * Quickly finds file dependencies by analyzing import statements.
     * Returns absolute file paths of dependencies in the same package.
     */
    async findFileDependencies(
        document: vscode.TextDocument,
        workspacePath: string
    ): Promise<Set<string>> {
        const dependencies = new Set<string>();
        const documentDir = document.uri.fsPath.substring(0, document.uri.fsPath.lastIndexOf('/'));
        
        try {
            // Scan only the first ~100 lines where imports typically appear
            const maxLinesToScan = Math.min(100, document.lineCount);
            
            for (let i = 0; i < maxLinesToScan; i++) {
                const line = document.lineAt(i).text.trim();
                
                // Stop at first non-import, non-comment, non-empty line after imports started
                if (line && 
                    !line.startsWith('import ') && 
                    !line.startsWith('export ') &&
                    !line.startsWith('//') && 
                    !line.startsWith('/*') &&
                    !line.startsWith('*') &&
                    !line.startsWith('library ') &&
                    !line.startsWith('part ') &&
                    dependencies.size > 0) {
                    break;
                }
                
                const importMatch = this.parseImportStatement(line);
                if (!importMatch) {
                    continue;
                }
                
                const { importPath, isRelative } = importMatch;
                
                // Skip external packages (dart:, package: from other packages)
                if (importPath.startsWith('dart:')) {
                    continue;
                }
                
                if (importPath.startsWith('package:')) {
                    // Check if it's from the same package
                    const resolvedPath = await this.resolvePackageImport(
                        importPath, 
                        workspacePath,
                        document.uri.fsPath
                    );
                    if (resolvedPath && DartPackageUtils.isInSamePackage(document.uri.fsPath, resolvedPath)) {
                        dependencies.add(resolvedPath);
                    }
                    continue;
                }
                
                // Handle relative imports
                if (isRelative) {
                    const resolvedPath = this.resolveRelativeImport(importPath, documentDir);
                    if (resolvedPath && DartPackageUtils.isInSamePackage(document.uri.fsPath, resolvedPath)) {
                        dependencies.add(resolvedPath);
                    }
                }
            }
            
            this.logger.trace(`Found ${dependencies.size} file dependencies in ${document.uri.fsPath}`);
            
        } catch (error) {
            this.logger.error(`Error finding dependencies: ${error}`);
        }
        
        return dependencies;
    }

    /**
     * Parses an import/export statement and extracts the path.
     * Returns null if the line is not an import/export statement.
     */
    private parseImportStatement(line: string): { importPath: string; isRelative: boolean } | null {
        // Match: import 'path'; or import "path";
        // Match: export 'path'; or export "path";
        const match = line.match(/^(?:import|export)\s+['"]([^'"]+)['"]/);
        if (!match) {
            return null;
        }
        
        const importPath = match[1];
        const isRelative = !importPath.startsWith('dart:') && !importPath.startsWith('package:');
        
        return { importPath, isRelative };
    }

    /**
     * Resolves a relative import path to an absolute file path.
     */
    private resolveRelativeImport(importPath: string, documentDir: string): string | null {
        try {
            // Remove any query parameters or fragments
            const cleanPath = importPath.split('?')[0].split('#')[0];
            
            // Join with document directory
            let resolvedPath = `${documentDir}/${cleanPath}`;
            
            // Normalize the path (resolve .. and .)
            const parts = resolvedPath.split('/');
            const normalized: string[] = [];
            
            for (const part of parts) {
                if (part === '..') {
                    if (normalized.length > 0) {
                        normalized.pop();
                    }
                } else if (part !== '.' && part !== '') {
                    normalized.push(part);
                }
            }
            
            // Rebuild absolute path with leading /
            resolvedPath = '/' + normalized.join('/');
            
            // Add .dart extension if not present
            if (!resolvedPath.endsWith('.dart')) {
                resolvedPath += '.dart';
            }
            
            return resolvedPath;
        } catch (error) {
            this.logger.error(`Error resolving relative import ${importPath}: ${error}`);
            return null;
        }
    }

    /**
     * Resolves a package: import to an absolute file path.
     * Example: package:myapp/models/user.dart -> /path/to/project/lib/models/user.dart
     */
    private async resolvePackageImport(
        importPath: string, 
        workspacePath: string,
        currentFilePath: string
    ): Promise<string | null> {
        try {
            // Extract package name and path
            // package:myapp/models/user.dart -> ["myapp", "models/user.dart"]
            const match = importPath.match(/^package:([^/]+)\/(.+)$/);
            if (!match) {
                return null;
            }
            
            const [, packageName, relativePath] = match;
            
            // Get the current file's package name
            const currentPackageName = await this.getPackageName(workspacePath);
            
            // Only resolve if it's the same package
            if (packageName !== currentPackageName) {
                return null;
            }
            
            // Convert to source directory path
            let resolvedPath = `${workspacePath}/${this.sourceDirectory}/${relativePath}`;
            
            // Add .dart extension if not present
            if (!resolvedPath.endsWith('.dart')) {
                resolvedPath += '.dart';
            }
            
            return resolvedPath;
        } catch (error) {
            this.logger.error(`Error resolving package import ${importPath}: ${error}`);
            return null;
        }
    }

    /**
     * Gets the package name from pubspec.yaml
     */
    private async getPackageName(workspacePath: string): Promise<string | null> {
        try {
            const pubspecPath = `${workspacePath}/pubspec.yaml`;
            const uri = vscode.Uri.file(pubspecPath);
            const document = await vscode.workspace.openTextDocument(uri);
            
            for (let i = 0; i < Math.min(50, document.lineCount); i++) {
                const line = document.lineAt(i).text;
                const match = line.match(/^name:\s*(.+)$/);
                if (match) {
                    return match[1].trim();
                }
            }
            
            return null;
        } catch (error) {
            this.logger.error(`Error reading pubspec.yaml: ${error}`);
            return null;
        }
    }
}
