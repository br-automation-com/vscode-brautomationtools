/**
 * Receive information for the AS projects within the workspaces
 * @packageDocumentation
 */

import * as vscode from "vscode";
import { AsProject } from "./AsProject";
import { statusBar } from "../UI/StatusBar";
import { AsProjectCBuildInfo } from "../Environment/AsProjectCBuildData";

export class WorkspaceProjects {
    /** static only class */
    private constructor() {}

    /**
     * Get all available AS projects within all workspace folders
     * @returns All available AS projects
     */
    public static async getProjects(): Promise<AsProject[]> {
        if (this.#projects === undefined) {
            this.#projects = this.#searchProjects();
            statusBar.addBusyItem(this.#projects, "Parsing AS projects in workspace");
        }
        return await this.#projects;
    }

    /**
     * Gets the AS project to which the given URI belongs.
     * @param uri URI which is checked to be within an AS project
     * @returns The AS project to which the URI belongs, or `undefined` if no AS project was found for the given URI.
     */
    public static async getProjectForUri(uri: vscode.Uri): Promise<AsProject | undefined> {
        // get projects and find matches
        const projects = await this.getProjects();
        const matches = projects.filter((p) => p.uriIsInProject(uri));
        // return best fitting match
        if (matches.length === 0) {
            return undefined;
        } else if (matches.length === 1) {
            return matches[0];
        } else {
            // multiple matches -> longest matching path is closest to the result
            // this could happen for a 'non conventional' folder structure, where you have an AS project within the root folder of another AS project
            let bestMatch = matches[0];
            for (const match of matches) {
                if (match.paths.projectRoot.path.length > bestMatch.paths.projectRoot.path.length) {
                    bestMatch = match;
                }
            }
            return bestMatch;
        }
    }

    /**
     * Get all C/C++ build information for a file
     * @param uri Uri to the file for which the build information should be collected
     */
    public static async getCBuildInformationForUri(uri: vscode.Uri): Promise<AsProjectCBuildInfo | undefined> {
        const project = await this.getProjectForUri(uri);
        return await project?.getCBuildInfo(uri);
    }

    /**
     * Starts a new search for available AS projects within all workspace folders
     * @returns All available AS projects after update
     */
    public static async updateProjects(): Promise<AsProject[]> {
        // dispose old projects
        //TODO ?????? is it gooooood to do here?
        const oldProjects = (await this.#projects) ?? [];
        for (const project of oldProjects) {
            project.dispose();
        }
        // set new projects
        this.#projects = this.#searchProjects();
        statusBar.addBusyItem(this.#projects, "Parsing AS projects in workspace");
        return await this.#projects;
    }
    static async #searchProjects(baseUri?: vscode.Uri): Promise<AsProject[]> {
        //TODO rework, was directly copied from old findAsProjectInfo() function
        //TODO move search to AsProject class?
        const searchPattern: vscode.GlobPattern = baseUri ? { base: baseUri.fsPath, pattern: "**/*.apj" } : "**/*.apj";
        const projectFileUris = await vscode.workspace.findFiles(searchPattern);
        const projects: AsProject[] = [];
        for (const projectFileUri of projectFileUris) {
            const project = await AsProject.createFromProjectFile(projectFileUri);
            if (project !== undefined) {
                projects.push(project);
                project.onActiveConfigurationChanged(() => this.#cppRelevantDataChangedEmitter.fire());
            }
        }
        this.#cppRelevantDataChangedEmitter.fire();
        return projects;
    }

    static #projects: Promise<AsProject[]> | undefined;

    static #cppRelevantDataChangedEmitter = new vscode.EventEmitter<void>();
    public static onCppRelevantDataChanged = this.#cppRelevantDataChangedEmitter.event;
}

//#region exported functions

/**
 * Activation of AS project workspace
 * @param context context to register disposables
 */
export function registerProjectWorkspace(context: vscode.ExtensionContext): void {
    // register to update on change of workspace folders
    const disposable = vscode.workspace.onDidChangeWorkspaceFolders(() => WorkspaceProjects.updateProjects()); // Should we register also outside of here in extension.ts?
    context.subscriptions.push(disposable);
    //TODO also push internal disposables (FileSystemWatcher...)? How? Figure out in #5 architectural changes.
}

//#endregion exported functions
