/**
 * Notifications for users
 * @packageDocumentation
 */
//TODO class as e.g. in ExtensionState

import * as vscode from 'vscode';
import { extensionConfiguration } from '../ExtensionConfiguration';
import { extensionState } from '../ExtensionState';
import { logger } from '../Tools/Logger';


//#region local types
//#endregion local types


//#region local functions


let extensionContext: vscode.ExtensionContext | undefined;


/**
 * Initialize this module
 * @param context The context of this extension
 */
async function initialize(context: vscode.ExtensionContext) {
    extensionContext = context;
}


/**
 * Shows a notification after activation of the extension
 * @returns A promise which resolves after the user reacted to the notification (dismissed or clicked an item)
 */
async function activationMessage(): Promise<void> {
    // Check context
    if (!extensionContext) {
        logger.debug(`BrNotifications.newVersionNotification() was called before initialization`);
        return;
    }
    // Show pop-up message if activated
    const hideNotification = extensionConfiguration.notifications.hideActivationMessage;
    const extensionName = extensionContext.extension.packageJSON.displayName;
    if (!hideNotification) {
        const message = `Extension ${extensionName} is now active`;
        const hideButton = "Don't show on activation";
        const result = await vscode.window.showInformationMessage(message, hideButton);
        if (result === hideButton) {
            extensionConfiguration.notifications.hideActivationMessage = true;
        }
    }
}


/**
 * Shows a notification when a new version was installed
 * @returns A promise which resolves after the user reacted to the notification (dismissed or clicked an item)
 */
async function newVersionMessage(): Promise<void> {
    // Check context
    if (!extensionContext) {
        logger.debug(`BrNotifications.newVersionNotification() was called before initialization`);
        return;
    }
    // Get saved state and actual extension version
    const shownVersionVal = extensionState.notifications.lastShownVersion;
    const hideNotification = extensionConfiguration.notifications.hideNewVersionMessage;
    const extensionVersion = extensionContext.extension.packageJSON.version;
    const extensionName = extensionContext.extension.packageJSON.displayName;
    // Show information message on update
    if (shownVersionVal !== extensionVersion) {
        // Update global state
        logger.info(`Extension was updated from ${shownVersionVal} to ${extensionVersion}`);
        extensionState.notifications.lastShownVersion = extensionVersion;
        // Show pop-up message if activated
        if (!hideNotification) {
            const message = `Welcome to the new version of ${extensionName}, ${extensionVersion}`;
            const hideButton = "Don't show again after update";
            const showInfoButton = 'Show changes';
            const result = await vscode.window.showInformationMessage(message, showInfoButton, hideButton);
            if (result === hideButton) {
                    extensionConfiguration.notifications.hideNewVersionMessage = true;
                }
            if (result === showInfoButton) {
                await vscode.env.openExternal(vscode.Uri.parse('https://github.com/br-automation-com/vscode-brautomationtools/blob/master/CHANGELOG.md'));
            }
        }
    }
}


async function configChangedMessage(): Promise<void> {
    // Check context
    if (!extensionContext) {
        logger.debug(`BrNotifications.configChangedMessage() was called before initialization`);
        return;
    }
    // Show pop-up message if activated
    const extensionName = extensionContext.extension.packageJSON.displayName;
    const message = `${extensionName} configuration was changed. Please reload window for changes to take effect.`;
    const reloadButton = 'Reload';
    const result = await vscode.window.showInformationMessage(message, reloadButton);
    if (result === reloadButton) {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
}


export const notifications = {
    initialize: initialize,
    activationMessage: activationMessage,
    newVersionMessage: newVersionMessage,
    configChangedMessage: configChangedMessage,
};


//#endregion local functions