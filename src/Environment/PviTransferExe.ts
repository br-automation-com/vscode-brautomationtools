/**
 * Handling PVITransfer.exe
 * @packageDocumentation
*/

import * as vscode from 'vscode';

export class PviTransferExe {
    //TODO implement

    constructor(executable: vscode.Uri) {
        this.#executable = executable;
    }
    
    /** The path to the PVITransfer.exe file */
    public get executable() : vscode.Uri {
        return this.#executable;
    }
    #executable: vscode.Uri;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            executable: this.executable.toString(true),
        };
    }
}