import * as vscode from 'vscode';
import * as BREnvironment from "./BREnvironment";
import * as BRConfiguration from "./BRConfiguration";
import * as BRDialogs from './BRDialogs';
import * as BRAsProjectWorkspace from './BRAsProjectWorkspace';


export async function testCommand() {
    console.log('Selection test started');
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