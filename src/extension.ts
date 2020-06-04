import * as vscode from 'vscode';
import { stringify } from 'querystring';
import * as BRCommands from './BRCommands';
import * as BRDialogs from './BRDialogs';
import * as BrIecHeaderProvider from './BrIecHeaderProvider';
import * as BrCppToolsApi from './BrCppToolsApi';
import * as BrAsBuildTaskProvider from './BrAsBuildTaskProvider';

// Activation event
export async function activate(context: vscode.ExtensionContext) {
	vscode.window.showInformationMessage('Extension B&R Automation Tools is now active');

	BRCommands.registerCommands(context);
	BrAsBuildTaskProvider.registerTaskProviders(context);
    BrCppToolsApi.registerCppToolsConfigurationProvider();
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('Your extension "vscode-brautomationtools" is now deactivated!');
	vscode.window.showInformationMessage('Extension B&R Automation Tools is now deactivated!');
}
