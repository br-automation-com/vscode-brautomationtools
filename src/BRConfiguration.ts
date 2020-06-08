/**
 * In here all access to the extension configuration values and TS types of configuration values are handled
 * see https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration
 * @packageDocumentation
 */

import * as vscode from 'vscode';


//#region interfaces for types

//#endregion interfaces for types

//#region setting of values
//#endregion setting of values

//#region getting of values
export function getAutomationStudioInstallPaths(): vscode.Uri[] {
    //TODO error checking if types do not match (both directions read and write) -> is this easily possible somehow?
    const config = getConfiguration();
    const configValue = config.get<string[]>('environment.automationStudioInstallPaths');
    if (configValue) {
        return configValue.map(fsPath => vscode.Uri.file(fsPath));
    }
    else {
        return [];
    }
}

export function getDefaultBuildMode() {
    //TODO error checking if types do not match (both directions read and write) -> is this easily possible somehow?
    const config = getConfiguration();
    const test = config.inspect('build.defaultBuildMode');
    console.log(test);
    return config.get<string>('build.defaultBuildMode');

}

export function getAllowedBuildModes() {
    //TODO error checking if types do not match (both directions read and write) -> is this easily possible somehow?
    const config = getConfiguration();
    //return config.get<string[]>('build.defaultBuildMode.enum'); //TODO does not work, how can I get enum values from schema in package.json?
    return ["Build", "Rebuild", "BuildAndTransfer", "BuildAndCreateCompactFlash"];

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