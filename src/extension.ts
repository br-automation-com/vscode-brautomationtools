import * as vscode from 'vscode';
import { stringify } from 'querystring';
import * as BRCommands from './BRCommands';
import * as BRDialogs from './BRDialogs';
import * as BrIecHeaderProvider from './BrIecHeaderProvider';
import * as BrCppToolsApi from './BrCppToolsApi';

// Activation event
export async function activate(context: vscode.ExtensionContext) {
	let disposable; // disposable to push for clean up on deactivation

	vscode.window.showInformationMessage('Extension B&R Automation Tools is now active');

	//#region Register commands
	// Command: Test
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.test',
		BRCommands.testCommand);
	context.subscriptions.push(disposable);

	// Command: Force activation of extension
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.forceActivate',
		() => {});
	context.subscriptions.push(disposable);
	
	// Command: Update configuration of installed AS versions from file system search
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.updateConfigInstalledAsVersionsFromSearch',
		BRCommands.updateConfigInstalledAsVersionsFromSearch);
	context.subscriptions.push(disposable);
	//#endregion Register commands

	//#region Register commands for dialogs, so they can be used in tasks...
	// Dialog command: select project configuration
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.dialogSelectASProjectConfiguration',
		BRDialogs.selectASProjectConfiguration);
	context.subscriptions.push(disposable);

	// Dialog command: select build mode
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.dialogSelectBuildMode',
		BRDialogs.selectBuildMode);
	context.subscriptions.push(disposable);
	//#endregion Register commands for dialogs, so they can be used in tasks...

	//#region External API
    BrCppToolsApi.registerCppToolsConfigurationProvider();
	//#endregion External API
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('Your extension "vscode-brautomationtools" is now deactivated!');
	vscode.window.showInformationMessage('Extension B&R Automation Tools is now deactivated!');
}
