/**
 * In here all access to the extension configuration values and TS types of configuration values are handled
 * see https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration
 * @packageDocumentation
 */
//SYNC Needs to be in sync with package.json/contributes/configuration/properties/*

import * as vscode from 'vscode';


//#region definitions and types from package.json contribution points
// No complex types contributed yet
//#endregion definitions and types from package.json contribution points

//#region setting of values
// No setters yet
//#endregion setting of values

//#region getting of values


/**
 * Gets the configured Automation Studio install paths.
 */
export function getAutomationStudioInstallPaths(): vscode.Uri[] {
    //TODO error checking if types do not match (both directions read and write) -> is this possible somehow?
    const config = getConfiguration();
    const configValue = config.get<string[]>('environment.automationStudioInstallPaths');
    if (configValue) {
        return configValue.map(fsPath => vscode.Uri.file(fsPath));
    }
    else {
        return [];
    }
}


/**
 * Gets the configured PVI install paths.
 */
export function getPviInstallPaths(): vscode.Uri[] {
    //TODO error checking if types do not match (both directions read and write) -> is this possible somehow?
    const config = getConfiguration();
    const configValue = config.get<string[]>('environment.pviInstallPaths');
    if (configValue) {
        return configValue.map(fsPath => vscode.Uri.file(fsPath));
    }
    else {
        return [];
    }
}


/**
 * Gets the default build mode.
 */
export function getDefaultBuildMode() {
    //TODO error checking if types do not match (both directions read and write) -> is this possible somehow?
    const config = getConfiguration();
    const test = config.inspect('build.defaultBuildMode');
    console.log(test);
    return config.get<string>('build.defaultBuildMode');

}


//#endregion getting of values


//#region local functions


/**
 * Get configuration of this extension
 */
function getConfiguration() {
    return vscode.workspace.getConfiguration('vscode-brautomationtools');
}


//#endregion local functions