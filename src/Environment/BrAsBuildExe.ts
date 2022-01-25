import * as vscode from 'vscode';

/**
 * Representation of Automation Studio build exe (BR.AS.Build.exe)
 */
export class BrAsBuildExe {
    //TODO maybe implement execution, args, ... directly in here

    public constructor(exePath: vscode.Uri) {
        this.#exePath = exePath;
    }
    
    /** The path to the BR.AS.Build.exe file */
    public get exePath() : vscode.Uri {
        return this.#exePath;
    }
    #exePath: vscode.Uri;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            exePath: this.exePath.toString(true),
        };
    }
}