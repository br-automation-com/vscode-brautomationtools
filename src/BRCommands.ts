import * as vscode from 'vscode';
import { BREnvironment } from "./BREnvironment";
import { BRConfiguration } from "./BRConfiguration";
import { BRDialogs } from './BRDialogs';
import { BRAsProjectWorkspace } from './BRAsProjectWorkspace';

export namespace BRCommands {
	export async function testCommand()
	{
        console.log('Selection test started');
        const selected = await BRAsProjectWorkspace.getUserSettings();
        console.log(`output is ${selected}`);
    }
    
    /**
     * Updates configuration value of installed AS versions from search in file system
     */
    export async function updateConfigInstalledAsVersionsFromSearch()
    {
        const foundVersions = await BREnvironment.getAvailableAutomationStudioVersions();
        await BRConfiguration.setAvailableAutomationStudioVersions(foundVersions);
    }
}