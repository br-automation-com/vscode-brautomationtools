/**
 * Handles notifications in the Status Bar of VS code
 * Check the guidelines for dos and donts
 * https://code.visualstudio.com/api/references/extension-guidelines#status-bar
 * @packageDocumentation
 */

import * as vscode from 'vscode';


export interface BusyItem {
    whenDone: Promise<any>,
    text: string | undefined
}


/** Status bar handling */
class StatusBar {
    static #instance: StatusBar = new StatusBar();
    public static getInstance(): StatusBar {
        return this.#instance;
    }


    private constructor() {
        // init busy status
        this.#busyStatus.name = 'B&R Tools busy indicator';
        this.#busyStatus.text = '$(sync~spin) B&R Tools';
    }


    /** Status bar busy indicator */
    #busyStatus = vscode.window.createStatusBarItem('vscode-brautomationtools.busyStatus',vscode.StatusBarAlignment.Left);
    /** Items shown in the status bar busy indicator */
    #busyItems: Set<BusyItem> = new Set();


    /**
     * Adds an item to the busy indicator in the status bar. Can be used for long running processes to show a feedback to the user.
     * When no item has an unresolved promise left, the busy indicator will be hidden.
     * @param hideWhenDone A promise which when resolved removes the item from the busy indicator
     * @param text An optional text which is shown as a line in the tooltip of the busy indicator
     * @returns The item which was created. It can be used to remove the item from the indicator before the promis was resolved.
     */
    addBusyItem(hideWhenDone: Promise<any>, text?: string | undefined): BusyItem {
        const item = {
            whenDone: hideWhenDone,
            text: text
        };
        this.#busyItems.add(item);
        this.#updateBusyStatus();
        hideWhenDone.then(() => this.removeBusyItem(item), () => this.removeBusyItem(item));
        return item;
    }


    /**
     * Removes an item from the busy indicator in the status bar.
     * @param item The item to remove from the busy indicator
     */
    removeBusyItem(item: BusyItem) {
        this.#busyItems.delete(item);
        this.#updateBusyStatus();
    }


    /** Updates the status of the busy indicator. */
    #updateBusyStatus() {
        if (this.#busyItems.size === 0) {
            this.#busyStatus.hide();
            return;
        }
        const tooltipLines: string[] = [];
        for (const item of this.#busyItems) {
            if (item.text) {
                tooltipLines.push(`$(sync~spin) ${item.text}`);
            }
        }
        const toolTipRaw = tooltipLines.join('\n\n');
        this.#busyStatus.tooltip = new vscode.MarkdownString(toolTipRaw, true);
        this.#busyStatus.show();
    }

    dispose() {
        this.#busyStatus.dispose();
    }
}

/** Access to the VS Code StatusBar */
export const statusBar = StatusBar.getInstance();