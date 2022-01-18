/**
 * Extension entry point
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import { logger } from './BrLog';
import {registerCommands} from './BRCommands';
import {registerCppToolsConfigurationProvider} from './ExternalApi/CppToolsApi';
import {registerTaskProviders as registerBuildTaskProviders} from './BrAsBuildTaskProvider';
import {registerTaskProviders as registerTransferTaskProviders} from './BrAsTransferTaskProvider';
import {registerApiTests} from './Tools/ApiTests';
import {getWorkspaceProjects, registerProjectWorkspace} from './BRAsProjectWorkspace';
import { notifications } from './UI/Notifications';
import { extensionState } from './BrExtensionState';
import { extensionConfiguration } from './BRConfiguration';
import { getAvailableAutomationStudioVersions } from './Environment/BREnvironment';
import { statusBar } from './UI/StatusBar';
import { Pvi } from './Environment/Pvi';


// Activation event
export async function activate(context: vscode.ExtensionContext) {
	// Set up logger
	logger.configuration = {
		level: extensionConfiguration.logging.logLevel,
		prettyPrintAdditionalData: extensionConfiguration.logging.prettyPrintAdditionalData
	};
	logger.info('Start activation of B&R Automation Tools extension');
	// Initialize modules
	extensionState.initialize(context);
	notifications.initialize(context);
	notifications.newVersionMessage();
	registerApiTests(context);
	registerCommands(context);
	registerBuildTaskProviders(context);
	registerTransferTaskProviders(context);
	// get promises for long running activation events and add to status bar
	const waitAsVersion = getAvailableAutomationStudioVersions();
	statusBar.addBusyItem(waitAsVersion, 'Searching for installed AS versions');
	const waitPviVersions = Pvi.getPviVersions();
	statusBar.addBusyItem(waitPviVersions, 'Searching for installed PVI versions');
	const waitWorkspaceProjects = getWorkspaceProjects();
	statusBar.addBusyItem(waitWorkspaceProjects, 'Parsing AS projects in workspace');
	// TODO do we need to await these? Will probably be remove after architectural changes #5
	await registerCppToolsConfigurationProvider(context);
	await registerProjectWorkspace(context);
	// Show activation message and log entry when all is done
	await Promise.all([
		waitAsVersion,
		waitPviVersions,
		waitWorkspaceProjects,
	]);
	logger.info('Activation of B&R Automation Tools extension finished');
	notifications.activationMessage();
}


// this method is called when your extension is deactivated
export function deactivate() {
	logger.info('Your extension "vscode-brautomationtools" is now deactivated!');
	vscode.window.showInformationMessage('Extension B&R Automation Tools is now deactivated!');
}
