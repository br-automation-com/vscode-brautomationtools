/**
 * Extension entry point
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import * as BRConfiguration from './BRConfiguration';
import { Logger } from './BrLog';
import {registerCommands} from './BRCommands';
import {registerCppToolsConfigurationProvider} from './BrCppToolsApi';
import {registerTaskProviders as registerBuildTaskProviders} from './BrAsBuildTaskProvider';
import {registerTaskProviders as registerTransferTaskProviders} from './BrAsTransferTaskProvider';
import {registerApiTests} from './Tools/ApiTests';
import {registerProjectWorkspace} from './BRAsProjectWorkspace';


// Activation event
export async function activate(context: vscode.ExtensionContext) {
	// Set up logger
	Logger.default.configuration = {
		level: BRConfiguration.getLogLevel()
	};
	Logger.default.info("Start activation of B&R Automation Tools extension");
	//
	registerApiTests(context);
	registerCommands(context);
	registerBuildTaskProviders(context);
	registerTransferTaskProviders(context);
	await registerCppToolsConfigurationProvider(context);
	await registerProjectWorkspace(context);
	Logger.default.info("Activation of B&R Automation Tools extension finished");
	vscode.window.showInformationMessage('Extension B&R Automation Tools is now active');
}


// this method is called when your extension is deactivated
export function deactivate() {
	Logger.default.info('Your extension "vscode-brautomationtools" is now deactivated!');
	vscode.window.showInformationMessage('Extension B&R Automation Tools is now deactivated!');
}
