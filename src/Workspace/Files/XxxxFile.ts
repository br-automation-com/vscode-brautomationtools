import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { logger } from '../../Tools/Logger';
import { AsXmlFile } from './AsXmlFile';

/**
 * XXXXX file representation (*.xxxx)
 */
export class XxxxFile extends AsXmlFile {

    /**
     * Creates an XXXX file representation from a specified URI to the file
     * @param filePath The XXXX file path. e.g. `C:\Projects\Test\XXXX.xxxx`
     * @returns The XXXX file representation which was parsed from the file
     */
    public static async createFromPath(filePath: Uri): Promise<XxxxFile | undefined> {
        // Create and initialize object
        try {
            const textDoc = await vscode.workspace.openTextDocument(filePath);
            const fileContent = textDoc.getText();
            return new XxxxFile(filePath, fileContent);
        } catch (error) {
            logger.error(`Failed to read XXXX file from path ${logger.formatUri(filePath)}. ${logger.formatError(error)}`);
            return undefined;
        }
    }

    /** TODO doc */
    protected constructor(filePath: Uri, fileContent: string) {
        super(filePath, fileContent);
        // initialize other properties here!
        this.#xxxxx = '42';
    }

    /** XXXXXX */
    public get xxxxx(): string {
        return this.#xxxxx;
    }
    #xxxxx: string;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        const obj = super.toJSON();
        obj.xxxxx = this.xxxxx;
        //TODO
        return obj;
    }
}