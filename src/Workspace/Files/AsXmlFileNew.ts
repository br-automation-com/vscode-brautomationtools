import * as vscode from 'vscode';
import { AsXmlVersionHeader } from './AsXmlFile';
import { AsXmlParser, AsXmlBuilder } from './AsXmlParser';
import { logger } from '../../Tools/Logger';
import { Uri } from 'vscode';

/**
 * Representation of a simple Automation Studio XML file. Can be extended for specialized Automation Studio Files
 */
export class AsXmlFileNew {

    /**
     * Automation Studio XML file representation from a specified file path
     * @param filePath The path to the XML file. e.g. `C:\Projects\Test\Logical\MyFolder\Package.pkg` or `C:\Projects\Test\Logical\MyLib\ANSIC.lby`
     * @returns The Automation Studio XML file representation which was parsed from the file
     */
    public static async createFromFile(filePath: Uri): Promise<AsXmlFileNew | undefined> {
        // Create and initialize object
        try {
            const textDoc = await vscode.workspace.openTextDocument(filePath);
            const fileContent = textDoc.getText();
            return new AsXmlFileNew(filePath, fileContent);
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to read XML file from path '${filePath.fsPath}': ${error.message}`); //TODO uri log #33
            } else {
                logger.error(`Failed to read XML file from path '${filePath.fsPath}'`); //TODO uri log #33
            }
            logger.debug('Error details:', { error });
            return undefined;
        }
    }

    /** TODO doc */
    protected constructor(filePath: vscode.Uri, fileContent: string) {
        const parser = new AsXmlParser();
        this.#filePath = filePath;
        this.#xmlObj = parser.parse(fileContent);
        this.#versionHeader = getXmlVersionHeader(this.#xmlObj);
    }

    /** Path to the source file */
    public get filePath(): vscode.Uri {
        return this.#filePath;
    }
    #filePath: vscode.Uri;

    /** The Automation Studio XML header data */
    public get versionHeader(): AsXmlVersionHeader {
        return this.#versionHeader;
    }
    public set versionHeader(value: AsXmlVersionHeader){
        throw new Error('NotImplemented'); // TODO Implement
    }
    #versionHeader: AsXmlVersionHeader;

    /** The javascript object representation of the XML */
    protected get xmlObj(): object {
        return this.#xmlObj;
    }
    #xmlObj: object;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            filePath: this.filePath.toString(true),
            versionHeader: this.versionHeader,
            xmlObj: this.xmlObj,
        };
    }

    /** Get the XML representation of the file */
    public toXml(): string {
        const builder = new AsXmlBuilder();
        return builder.build(this.#xmlObj);
    }
}

/**
 * Get all existing version information from the AutomationStudio XML processing instruction header
 */
function getXmlVersionHeader(xmlObj: object): AsXmlVersionHeader {
    //TODO currently does not work with old PI of AS version (not in attribute syntax)
    const xmlAny = xmlObj as any; //HACK to access by indexer. find out how to solve properly?
    const versionObj = xmlAny?.['?AutomationStudio']?._att;
    const asVersion = versionObj.Version as unknown;
    const asWorkingVersion = versionObj.WorkingVersion as unknown;
    const asFileVersion = versionObj.FileVersion as unknown;
    // return value
    return {
        asVersion: typeof asVersion === 'string' ? asVersion : undefined,
        asWorkingVersion: typeof asWorkingVersion === 'string' ? asWorkingVersion : undefined,
        asFileVersion: typeof asFileVersion === 'string' ? asFileVersion : undefined,
    };
}