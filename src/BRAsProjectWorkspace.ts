import * as vscode from 'vscode';
import * as Helpers from './Tools/Helpers';
import * as uriTools from './Tools/UriTools';


//#region interfaces
export interface ProjectBaseUris {
    base: vscode.Uri,
    projectFile: vscode.Uri,
    logical: vscode.Uri,
    physical: vscode.Uri,
    temporary: vscode.Uri,
    temporaryIncludes: vscode.Uri
}
//#endregion interfaces

/**
 * Get all available AS configurations in the AS project
 */
export async function getAvailableConfigurations(): Promise<string[] | undefined> {
    //TODO maybe get in context of an AS project file to support workspaces with multiple projects or where the Physical dir is not the in the root of the workspace
    if (vscode.workspace.workspaceFolders !== undefined) {
        //TODO get from Physical.xml
        const projectUri = vscode.workspace.workspaceFolders[0].uri;
        const physicalUri = uriTools.pathJoin(projectUri, 'Physical');
        const configFolders = uriTools.listSubDirectoryNames(physicalUri);
        return configFolders;
    }
    else {
        return undefined;
    }
}

export async function getUserSettings() {
    vscode.workspace.textDocuments;
    //const settingUris = await vscode.workspace.findFiles('*.set');
    const settingUris = await vscode.workspace.findFiles('LastUser.set');
    if (settingUris.length === 0) {
        return undefined;
    }
    const usedSettingUri = settingUris[0]; //TODO get username.set if possible
    const settingDocument = await vscode.workspace.openTextDocument(usedSettingUri);
    const text = settingDocument.getText();
    //TODO XML parsing

    return text;
}

export async function getProjectBaseUris(): Promise<ProjectBaseUris | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders; //TODO create helper for getting of workspace which only allows single folder...
    if (workspaceFolders !== undefined) {
        //TODO get URIs properly, especially AS project
        const workspaceUri = workspaceFolders[0].uri;
        const projectBaseUris: ProjectBaseUris = {
            base: workspaceUri,
            projectFile:       uriTools.pathJoin(workspaceUri, 'AsTestPrj.apj'),
            logical:           uriTools.pathJoin(workspaceUri, 'Logical'),
            physical:          uriTools.pathJoin(workspaceUri, 'Physical'),
            temporary:         uriTools.pathJoin(workspaceUri, 'Temp'),
            temporaryIncludes: uriTools.pathJoin(workspaceUri, 'Temp/Includes')
        };
        return projectBaseUris;
    }
    else {
        return undefined;
    }
}