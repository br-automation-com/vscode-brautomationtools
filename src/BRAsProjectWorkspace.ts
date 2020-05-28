import * as vscode from 'vscode';
import { Helpers } from './Helpers';

export namespace BRAsProjectWorkspace {
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
	export async function getAvailableConfigurations(){
		if (vscode.workspace.workspaceFolders !== undefined)
		{
            //TODO get from Physical.xml
			const projectUri = vscode.workspace.workspaceFolders[0].uri;
			const physicalUri = Helpers.appendUri(projectUri, 'Physical', true);
			const configFolders = Helpers.listDirectories(physicalUri);
			return configFolders;
		}
		else
		{
			return undefined;
		}
    }
    
    export async function getUserSettings()
    {
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

    export async function getProjectBaseUris(): Promise<ProjectBaseUris | undefined>
    {
        const workspaceFolders = vscode.workspace.workspaceFolders; //TODO create helper for getting of workspace which only allows single folder...
        if (workspaceFolders !== undefined) {
            //TODO get URIs properly, especially AS project
            const workspaceUri = workspaceFolders[0].uri;
            const projectBaseUris: ProjectBaseUris = {
                base: workspaceUri,
                projectFile: Helpers.appendUri(workspaceUri, 'AsTestPrj.apj', true),
                logical: Helpers.appendUri(workspaceUri, 'Logical', true),
                physical: Helpers.appendUri(workspaceUri, 'Physical', true),
                temporary: Helpers.appendUri(workspaceUri, 'Temp', true),
                temporaryIncludes: Helpers.appendUri(workspaceUri, 'Temp/Includes', true)
            };
            return projectBaseUris;
        }
        else {
            return undefined;
        }
    }
}