/**
 * Commands of the extension.
 * @packageDocumentation
 */

import * as vscode from "vscode";
import { Environment } from "./Environment/Environment";
import * as BRDialogs from "./UI/BrDialogs";
import { logger } from "./Tools/Logger";
import { AsPackageFile } from "./Workspace/Files/AsPackageFile";

/**
 * Registers all commands of the extension
 * @param context Extension context to push disposables
 */
export function registerCommands(context: vscode.ExtensionContext): void {
    registerContributedCommands(context);
    registerHiddenCommands(context);
}

/**
 * Registers all commands which are defined as contributes in package.json. These commands can be used
 * in the command palette of VS Code (Ctrl + Shift + P).
 * @param context Extension context to push disposables
 */
//SYNC Command IDs need to be in sync with package.json/contributes/commands[n]/command
function registerContributedCommands(context: vscode.ExtensionContext): void {
    let disposable: vscode.Disposable | undefined; // temporary disposable to push in array
    // Force activation of extension
    disposable = vscode.commands.registerCommand(
        "vscode-brautomationtools.forceActivate", //
        () => {
            return;
        }
    );
    context.subscriptions.push(disposable);
    // Update configuration of installed AS versions from file system search
    disposable = vscode.commands.registerCommand(
        "vscode-brautomationtools.updateAvailableAutomationStudioVersions", //
        async () => await Environment.automationStudio.updateVersions()
    );
    context.subscriptions.push(disposable);
    // Change the active configuration of a project
    disposable = vscode.commands.registerCommand(
        "vscode-brautomationtools.changeActiveConfiguration", //
        changeActiveConfiguration
    );
    // Update all AS Package entries
    disposable = vscode.commands.registerCommand(
        "vscode-brautomationtools.updateAllPackageFileEntries", //
        (fileUri) => updateAllPackageFileEtriesCommand(fileUri)
    );
    context.subscriptions.push(disposable);
    // Add missing AS Package entries
    disposable = vscode.commands.registerCommand(
        "vscode-brautomationtools.addMissingPackageFileEntries", //
        (fileUri) => addMissingPackageFileEntriesCommand(fileUri)
    );
    context.subscriptions.push(disposable);
    // Remove non existing AS Package entries
    disposable = vscode.commands.registerCommand(
        "vscode-brautomationtools.removeNonExistingPackageFileEntries", //
        (fileUri) => removeNonExistingPackageFileEntriesCommand(fileUri)
    );
    context.subscriptions.push(disposable);
}

/**
 * Registers all commands which are NOT defined as contributes in package.json. These commands can be used
 * in tasks.json and launch.json by setting a value to `${command:<CommandID>}`. The user cannot see these
 * commands in the command palette.
 *
 * See also [VS Code doc](https://code.visualstudio.com/docs/editor/variables-reference#_command-variables)
 * @param context Extension context to push disposables
 */
function registerHiddenCommands(context: vscode.ExtensionContext): void {
    let disposable: vscode.Disposable | undefined; // temporary disposable to push in array
    // Dialog command: select build mode
    disposable = vscode.commands.registerCommand(
        "vscode-brautomationtools.dialogSelectBuildMode", //
        BRDialogs.selectBuildMode
    );
    context.subscriptions.push(disposable);
    //
    disposable = undefined;
}

/**
 * Change the active configuration of a selected project within the workspace
 */
async function changeActiveConfiguration(): Promise<void> {
    const project = await BRDialogs.selectAsProjectFromWorkspace();
    if (project === undefined) return;
    const config = await BRDialogs.selectASProjectConfiguration(project);
    if (config === undefined) return;
    await project.changeActiveConfiguration(config.name);
}

async function updateAllPackageFileEtriesCommand(fileUri: unknown): Promise<void> {
    // TODO make also new command "add reference to package" -> select normal file makes file ref, selecting package file makes pkg ref
    logger.detail("Try to update package file");
    fileUri = fileUri ?? vscode.window.activeTextEditor?.document.uri;
    if (!(fileUri instanceof vscode.Uri)) {
        logger.error("Update package command call first argument is not a URI");
        return;
    }
    // Update package
    // TODO keep the function here? where would this function fit well?
    const pkg = await AsPackageFile.createFromFile(fileUri);
    await pkg?.updateChildren(true);
    const success = await pkg?.writeToFile();
    if (success === true) {
        logger.info(`Package file ${logger.formatUri(fileUri)} updated.`);
    } else {
        logger.error(`Failed to update package file ${logger.formatUri(fileUri)}`);
    }
}

async function addMissingPackageFileEntriesCommand(fileUri: unknown): Promise<void> {
    logger.detail("Try to add missing entries to package file");
    fileUri = fileUri ?? vscode.window.activeTextEditor?.document.uri;
    if (!(fileUri instanceof vscode.Uri)) {
        logger.error("Update package command call first argument is not a URI");
        return;
    }
    // Update package
    // TODO keep the function here? where would this function fit well?
    const pkg = await AsPackageFile.createFromFile(fileUri);
    await pkg?.addMissingChildren();
    const success = await pkg?.writeToFile();
    if (success === true) {
        logger.info(`Added missing entries to package file ${logger.formatUri(fileUri)}.`);
    } else {
        logger.error(`Failed to update package file ${logger.formatUri(fileUri)}`);
    }
}

async function removeNonExistingPackageFileEntriesCommand(fileUri: unknown): Promise<void> {
    logger.detail("Try to remove not existing entries from package file");
    fileUri = fileUri ?? vscode.window.activeTextEditor?.document.uri;
    if (!(fileUri instanceof vscode.Uri)) {
        logger.error("Update package command call first argument is not a URI");
        return;
    }
    // Update package
    // TODO keep the function here? where would this function fit well?
    const pkg = await AsPackageFile.createFromFile(fileUri);
    await pkg?.removeNonExtistingChildren(true); // TODO from settings or dialog here?
    const success = await pkg?.writeToFile();
    if (success === true) {
        logger.info(`Removed not existing entries from package file ${logger.formatUri(fileUri)}`);
    } else {
        logger.error(`Failed to update package file ${logger.formatUri(fileUri)}`);
    }
}
