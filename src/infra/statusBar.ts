import * as vscode from 'vscode';

export interface ProgressInfo {
    current: number;
    total: number;
    phase: 'discovering' | 'extracting' | 'analyzing' | 'processing';
    details?: string;
}

/**
 * Wrapper for VS Code status bar API.
 * Single Responsibility: Status bar progress indication.
 */
export class StatusBar {
    private static instance: vscode.StatusBarItem | null = null;
    private static showDetailed: boolean = false;
    private static currentProgress: ProgressInfo | null = null;

    static initialize(statusBarItem: vscode.StatusBarItem): void {
        this.instance = statusBarItem;
        // Make status bar clickable to toggle detailed view
        this.instance.command = 'dartUnusedCode.toggleStatusBarDetail';
    }

    static toggleDetailedView(): void {
        this.showDetailed = !this.showDetailed;
        // Refresh display with current progress if available
        if (this.currentProgress) {
            this.updateProgress(this.currentProgress);
        }
    }

    static showProgress(message: string = 'Analyzing...'): void {
        if (!this.instance) {
            return;
        }
        this.instance.text = `$(sync~spin) ${message}`;
        this.instance.show();
    }

    static updateProgress(progress: ProgressInfo): void {
        if (!this.instance) {
            return;
        }

        // Store current progress for toggle
        this.currentProgress = progress;

        const percentage = progress.total > 0 
            ? Math.round((progress.current / progress.total) * 100)
            : 0;

        let phaseLabel = '';
        let phaseShort = '';
        switch (progress.phase) {
            case 'discovering':
                phaseLabel = 'Discovering files';
                phaseShort = 'Discovering';
                break;
            case 'extracting':
                phaseLabel = 'Extracting methods';
                phaseShort = 'Extracting';
                break;
            case 'analyzing':
                phaseLabel = 'Analyzing methods';
                phaseShort = 'Analyzing';
                break;
            case 'processing':
                phaseLabel = 'Processing';
                phaseShort = 'Processing';
                break;
        }

        if (this.showDetailed) {
            // Detailed view: show phase, counts, percentage, and details
            const details = progress.details ? ` - ${progress.details}` : '';
            this.instance.text = `$(sync~spin) ${phaseLabel}: ${progress.current}/${progress.total} (${percentage}%)${details}`;
            this.instance.tooltip = 'Click to show minimal view';
        } else {
            // Minimal view: show only phase and percentage
            this.instance.text = `$(sync~spin) ${phaseShort} ${percentage}%`;
            this.instance.tooltip = `${phaseLabel}: ${progress.current}/${progress.total} - Click for details`;
        }
        
        this.instance.show();
    }

    static hide(): void {
        if (!this.instance) {
            return;
        }
        this.currentProgress = null;
        this.instance.hide();
    }

    static dispose(): void {
        if (this.instance) {
            this.instance.dispose();
            this.instance = null;
        }
    }
}
