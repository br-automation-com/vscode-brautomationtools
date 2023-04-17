/**
 * Commands of the extension.
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import { Environment } from './Environment/Environment';
import * as BRDialogs from './UI/BrDialogs';


/**
 * Registers all commands of the extension
 * @param context Extension context to push disposables
 */
export function registerCommands(context: vscode.ExtensionContext) {
    registerContributedCommands(context);
    registerHiddenCommands(context);
}


/**
 * Registers all commands which are defined as contributes in package.json. These commands can be used
 * in the command palette of VS Code (Ctrl + Shift + P).
 * @param context Extension context to push disposables
 */
//SYNC Command IDs need to be in sync with package.json/contributes/commands[n]/command
function registerContributedCommands(context: vscode.ExtensionContext) {
    let disposable: vscode.Disposable | undefined; // temporary disposable to push in array
    // Force activation of extension
    disposable = vscode.commands.registerCommand('vscode-brautomationtools.forceActivate',
        () => { });
    context.subscriptions.push(disposable);
    // Update configuration of installed AS versions from file system search
    disposable = vscode.commands.registerCommand('vscode-brautomationtools.updateAvailableAutomationStudioVersions',
        Environment.automationStudio.updateVersions);
    context.subscriptions.push(disposable);
    // Change the active configuration of a project
    disposable = vscode.commands.registerCommand('vscode-brautomationtools.changeActiveConfiguration',
        changeActiveConfiguration);
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
function registerHiddenCommands(context: vscode.ExtensionContext) {
    let disposable: vscode.Disposable | undefined; // temporary disposable to push in array
    // Dialog command: select build mode
    disposable = vscode.commands.registerCommand('vscode-brautomationtools.dialogSelectBuildMode',
        BRDialogs.selectBuildMode);
    context.subscriptions.push(disposable);
}


/**
 * Change the active configuration of a selected project within the workspace
 */
async function changeActiveConfiguration(): Promise<void> {
    const project = await BRDialogs.selectAsProjectFromWorkspace();
    if (project === undefined) { return; }
    const config = await BRDialogs.selectASProjectConfiguration(project);
    if (config === undefined) { return; }
    await project.changeActiveConfiguration(config.name);
}