import { StatusBar } from '../infra/statusBar';

/**
 * Command to toggle status bar detail view.
 * Single Responsibility: Toggle between minimal and detailed status bar display.
 */
export class ToggleStatusBarDetailCommand {
    execute(): void {
        StatusBar.toggleDetailedView();
    }
}
