/**
 * In here all access to the extension configuration values and TS types of configuration values are handled
 * see https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration
 * @packageDocumentation
 */

import * as vscode from 'vscode';


//#region interfaces for types
/**
 * B&R Automation Studio version and installation information
 */
export interface AsVersionInformation {
    version: string;
    installPath: string;
    gccVersions: Array<AsGccVersionInformation>;
}

/**
 * Information of gcc installation within B&R Automation Studio
 */
export interface AsGccVersionInformation {
    version: string;
    automationStudioRelativePath: string;
}
//#endregion interfaces for types

//#region setting of values
export async function setAvailableAutomationStudioVersions(versions: Array<AsVersionInformation>) {
    //TODO error checking if types do not match (both directions read and write) -> is this easily possible somehow?
    const config = getConfiguration();
    await config.update('environment.installedAutomationStudioVersions', versions, true);
}
//#endregion setting of values

//#region getting of values
export function getAvailableAutomationStudioVersions() {
    //TODO error checking if types do not match (both directions read and write) -> is this easily possible somehow?
    const config = getConfiguration();
    return config.get<AsVersionInformation[]>('environment.installedAutomationStudioVersions');

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

//#region internal functions
/**
 * Get configuration of this extension
 */
function getConfiguration() {
    return vscode.workspace.getConfiguration('vscode-brautomationtools');
}
    //#endregion internal functions