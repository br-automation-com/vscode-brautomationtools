/**
 * Handling PVITransfer.exe
 * @packageDocumentation
*/

import * as vscode from 'vscode';

export class PviTransferExe {
    //TODO implement

    constructor(executable: vscode.Uri) {
        this.#filePath = executable;
    }


    /** The path to the PVITransfer.exe file */
    public get filePath() : vscode.Uri {
        return this.#filePath;
    }
    #filePath: vscode.Uri;
}