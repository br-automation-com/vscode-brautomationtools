import * as vscode from 'vscode';
import * as BREnvironment from "./BREnvironment";
import * as BRConfiguration from "./BRConfiguration";
import * as BRDialogs from './BRDialogs';
import * as BRAsProjectWorkspace from './BRAsProjectWorkspace';

/**
 * Registers all commands of the extension
 * @param context Extension context to push disposables
 */
export function registerCommands(context: vscode.ExtensionContext) {
    let disposable: vscode.Disposable | undefined; // disposable to push for clean up on deactivation
    //#region Commands accessible in UI by using Ctrl+Shift+P
	// Command: Test
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.test',
		(arg1, arg2) => testCommand(arg1, arg2));
	context.subscriptions.push(disposable);
	// Command: Force activation of extension
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.forceActivate',
		() => {});
	context.subscriptions.push(disposable);
	// Command: Update configuration of installed AS versions from file system search
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.updateConfigInstalledAsVersionsFromSearch',
		updateConfigInstalledAsVersionsFromSearch);
	context.subscriptions.push(disposable);
    //#endregion Commands accessible in UI by using Ctrl+Shift+P
    
    //#region Commands for dialogs, so they can be used in tasks...
	// Dialog command: select project configuration
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.dialogSelectASProjectConfiguration',
		BRDialogs.selectASProjectConfiguration);
	context.subscriptions.push(disposable);

	// Dialog command: select build mode
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.dialogSelectBuildMode',
		BRDialogs.selectBuildMode);
	context.subscriptions.push(disposable);
	//#endregion Commands for dialogs, so they can be used in tasks...
}

export async function testCommand(arg1: any, arg2: any) {
	console.log('Selection test started');
	console.log('arg1');
	console.log(arg1);
	console.log('arg2');
	console.log(arg2);
    const selected = await BRAsProjectWorkspace.getUserSettings();
    console.log(`output is ${selected}`);
}

/**
 * Updates configuration value of installed AS versions from search in file system
 */
export async function updateConfigInstalledAsVersionsFromSearch() {
    const foundVersions = await BREnvironment.getAvailableAutomationStudioVersions();
    await BRConfiguration.setAvailableAutomationStudioVersions(foundVersions);
}