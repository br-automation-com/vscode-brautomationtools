import * as vscode from 'vscode';

/**
 * Representation of PVITransfer.exe
 */
export class PviTransferExe {
    //TODO maybe implement execution, args, ... directly in here

    /**
     * Creates a PVITransfer.exe representation
     * @param exePath URI to the PVITransfer.exe
     */
    public constructor(exePath: vscode.Uri) {
        this.#exePath = exePath;
    }
    
    /** The path to the PVITransfer.exe file */
    public get exePath() : vscode.Uri {
        return this.#exePath;
    }
    #exePath: vscode.Uri;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): Record<string, unknown> {
        return {
            exePath: this.exePath.toString(true),
        };
    }
}