import * as vscode from 'vscode';
import {registerCommands} from './BRCommands';
import {registerCppToolsConfigurationProvider} from './BrCppToolsApi';
import {registerTaskProviders} from './BrAsBuildTaskProvider';
import {registerApiTests} from './Tools/ApiTests';

// Activation event
export async function activate(context: vscode.ExtensionContext) {
	vscode.window.showInformationMessage('Extension B&R Automation Tools is now active');
	registerApiTests(context);
	registerCommands(context);
	registerTaskProviders(context);
    registerCppToolsConfigurationProvider(context);
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('Your extension "vscode-brautomationtools" is now deactivated!');
	vscode.window.showInformationMessage('Extension B&R Automation Tools is now deactivated!');
}
