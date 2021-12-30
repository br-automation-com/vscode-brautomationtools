/**
 * Extension entry point
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import { logger } from './BrLog';
import {registerCommands} from './BRCommands';
import {registerCppToolsConfigurationProvider} from './BrCppToolsApi';
import {registerTaskProviders as registerBuildTaskProviders} from './BrAsBuildTaskProvider';
import {registerTaskProviders as registerTransferTaskProviders} from './BrAsTransferTaskProvider';
import {registerApiTests} from './Tools/ApiTests';
import {registerProjectWorkspace} from './BRAsProjectWorkspace';
import { notifications } from './BrNotifications';
import { extensionState } from './BrExtensionState';
import { extensionConfiguration } from './BRConfiguration';


// Activation event
export async function activate(context: vscode.ExtensionContext) {
	// Set up logger
	logger.configuration = {
		level: extensionConfiguration.logging.logLevel
	};
	logger.info("Start activation of B&R Automation Tools extension");
	//
	extensionState.initialize(context);
	notifications.initialize(context);
	notifications.newVersionMessage();
	registerApiTests(context);
	registerCommands(context);
	registerBuildTaskProviders(context);
	registerTransferTaskProviders(context);
	await registerCppToolsConfigurationProvider(context);
	await registerProjectWorkspace(context);
	logger.info("Activation of B&R Automation Tools extension finished");
	notifications.activationMessage();
}


// this method is called when your extension is deactivated
export function deactivate() {
	logger.info('Your extension "vscode-brautomationtools" is now deactivated!');
	vscode.window.showInformationMessage('Extension B&R Automation Tools is now deactivated!');
}
