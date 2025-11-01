import * as vscode from 'vscode';
import * as path from 'path';
import { minimatch } from 'minimatch';
import { Logger, MethodInfo } from '../shared/types';
import { VscodeCommands } from '../infra/vscodeCommands';

/**
 * Analyzes method references using VS Code's Reference Provider.
 * Single Responsibility: Reference analysis and usage detection.
 */
export class ReferenceAnalyzer {
    constructor(
        private readonly vscodeCommands: VscodeCommands,
        private readonly logger: Logger
    ) {}

    /**
     * Determines if a method is unused by checking its references.
     * A method is unused if it has <= 1 reference (only the definition).
     */
    async isMethodUnused(
        method: MethodInfo, 
        excludePatterns: string[], 
        workspacePath: string
    ): Promise<boolean> {
        try {
            const methodIdentifier = method.className 
                ? `${method.className}.${method.name}:${method.range.start.line}`
                : `${method.name}:${method.range.start.line}`;

            const references = await this.findReferences(method);
            
            if (references.length === 0) {
                this.logger.trace(` ${methodIdentifier}: No references found`);
                return true;
            }

            this.logger.trace(` ${methodIdentifier}: Found ${references.length} total references`);
            this.logger.trace(` Method definition: ${path.relative(workspacePath, method.filePath)}:${method.range.start.line}`);
            references.forEach((ref, idx) => {
                const relativePath = path.relative(workspacePath, ref.uri.fsPath);
                const displayPath = relativePath.startsWith('..') ? ref.uri.fsPath : relativePath;
                const isDefinition = ref.uri.fsPath === method.filePath && ref.range.start.line === method.range.start.line;
                const marker = isDefinition ? ' [DEFINITION]' : '';
                this.logger.trace(`  [${idx}] ${methodIdentifier} -> ${displayPath}:${ref.range.start.line}:${ref.range.start.character}${marker}`);
            });

            this.logger.trace(` ${methodIdentifier}: ${references.length} references found`);

            const filteredReferences = this.filterExcludedReferences(
                references,
                excludePatterns, 
                workspacePath,
                methodIdentifier
            );            this.logger.trace(` ${methodIdentifier}: ${filteredReferences.length} non-excluded references`);

            // Separate definition from actual usage references
            // Convert method.filePath to URI and use fsPath for consistent cross-platform comparison
            // This ensures both paths go through the same normalization process
            const methodFsPath = vscode.Uri.file(method.filePath).fsPath;
            const definitionReferences = filteredReferences.filter(ref => 
                ref.uri.fsPath === methodFsPath && 
                ref.range.start.line === method.range.start.line
            );
            const usageReferences = filteredReferences.filter(ref => 
                !(ref.uri.fsPath === methodFsPath && ref.range.start.line === method.range.start.line)
            );

            this.logger.trace(` ${methodIdentifier}: ${definitionReferences.length} definition(s), ${usageReferences.length} usage(s)`);

            // Method is unused if it has no actual usage references (only definition)
            const isUnused = usageReferences.length === 0;
            this.logger.info(
                `[REFERENCE_ANALYZER] ${methodIdentifier}: unused=${isUnused} ` +
                `(${usageReferences.length} usage references, ${definitionReferences.length} definitions)`
            );

            return isUnused;
        } catch (error) {
            this.logger.trace(` Error analyzing ${method.name}: ${error}`);
            // If we can't analyze, assume it's used (fail-safe)
            return false;
        }
    }

    private async findReferences(method: MethodInfo): Promise<vscode.Location[]> {
        const uri = vscode.Uri.file(method.filePath);
        const position = method.range.start;

        const methodIdentifier = method.className 
            ? `${method.className}.${method.name}:${method.range.start.line}`
            : `${method.name}:${method.range.start.line}`;

        this.logger.trace(` ${methodIdentifier}: Querying references at ${method.filePath}:${position.line}:${position.character}`);

        // Try the exact position first
        let locations = await this.vscodeCommands.getReferences(uri, position);

        this.logger.trace(` ${methodIdentifier}: executeReferenceProvider returned ${locations?.length || 0} results`);

        // If no results or only 1 result (likely just definition), retry with longer delay
        // Analysis Server might still be indexing the file
        if (!locations || locations.length <= 1) {
            this.logger.trace(` ${methodIdentifier}: ${locations?.length || 0} results found, retrying with 500ms delay for full indexing...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            locations = await this.vscodeCommands.getReferences(uri, position);
            this.logger.trace(` ${methodIdentifier}: Retry returned ${locations?.length || 0} results`);
        }

        return locations || [];
    }

    private filterExcludedReferences(
        references: vscode.Location[], 
        excludePatterns: string[], 
        workspacePath: string,
        methodName: string
    ): vscode.Location[] {
        return references.filter(location => {
            const relativePath = path.relative(workspacePath, location.uri.fsPath);
            // Convert to forward slashes for consistent glob matching across platforms
            const normalizedPath = relativePath.split(path.sep).join('/');
            const matchedPattern = this.getMatchedPattern(normalizedPath, excludePatterns);
            
            if (matchedPattern) {
                this.logger.trace(`  [EXCLUDED] ${methodName} -> ${normalizedPath} (matched pattern: "${matchedPattern}")`);
                return false;
            }
            
            return true;
        });
    }

    private getMatchedPattern(relativePath: string, patterns: string[]): string | null {
        for (const pattern of patterns) {
            // Use minimatch for proper glob pattern matching
            if (minimatch(relativePath, pattern)) {
                return pattern;
            }
        }
        return null;
    }
}
