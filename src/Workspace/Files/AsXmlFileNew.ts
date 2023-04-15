import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { logger } from '../../Tools/Logger';
import { AsXmlVersionHeader } from './AsXmlFile';
import { AsXmlBuilder, AsXmlParser, ParsedXmlObject } from './AsXmlParser';

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
                logger.error(`Failed to read XML file from path "${filePath.fsPath}": ${error.message}`); //TODO uri log #33
            } else {
                logger.error(`Failed to read XML file from path "${filePath.fsPath}"`); //TODO uri log #33 solved like this, but maybe whole URI to not limit ourselves? -> Method in logger logger.uriToLog(uri)
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
        const root = getXmlRootData(this.#xmlObj);
        this.#xmlRootObj = root.value;
        this.#xmlRootName = root.name;
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
    public set versionHeader(value: AsXmlVersionHeader) {
        this.#versionHeader = value;
        setXmlVersionHeader(this.#xmlObj, value);
    }
    #versionHeader: AsXmlVersionHeader;

    /** The javascript object representation of the XML */
    protected get xmlObj(): ParsedXmlObject {
        return this.#xmlObj;
    }
    #xmlObj: ParsedXmlObject;

    /** The name of the XML root element */
    protected get xmlRootName(): string {
        return this.#xmlRootName;
    }
    #xmlRootName: string;


    /** The javascript object representation of the XML root element */
    protected get xmlRootObj(): ParsedXmlObject {
        return this.#xmlRootObj;
    }
    #xmlRootObj: ParsedXmlObject;


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
function getXmlVersionHeader(xmlObj: ParsedXmlObject): AsXmlVersionHeader {
    //TODO currently does not work with old PI of AS version (not in attribute syntax)
    const xmlAny = xmlObj as any; //HACK to access by indexer. find out how to solve properly?
    const versionObj = xmlAny?.['?AutomationStudio']?._att;
    const asVersion = versionObj?.Version as unknown;
    const asWorkingVersion = versionObj?.WorkingVersion as unknown;
    const asFileVersion = versionObj?.FileVersion as unknown;
    // return value
    return {
        asVersion: typeof asVersion === 'string' ? asVersion : undefined,
        asWorkingVersion: typeof asWorkingVersion === 'string' ? asWorkingVersion : undefined,
        asFileVersion: typeof asFileVersion === 'string' ? asFileVersion : undefined,
    };
}

/**
 * Change the XML version information header to new data
 */
function setXmlVersionHeader(xmlObj: ParsedXmlObject, versionHeader: AsXmlVersionHeader): void {
    // Only assign properties if the value is defined. Properties with assigned property and value undefined will lead to attr="undefined"
    const attributesObj: Record<string, string> = {};
    if (versionHeader.asVersion !== undefined) {
        attributesObj.Version = versionHeader.asVersion;
    }
    if (versionHeader.asWorkingVersion !== undefined) {
        attributesObj.WorkingVersion = versionHeader.asWorkingVersion;
    }
    if (versionHeader.asFileVersion !== undefined) {
        attributesObj.FileVersion = versionHeader.asFileVersion;
    }
    // add attribute object to PI node
    const xmlAny = xmlObj as any; //HACK to access by indexer. find out how to solve properly?
    xmlAny['?AutomationStudio'] = { _att: attributesObj };
}

function getXmlRootData(xmlObj: ParsedXmlObject): { name: string, value: ParsedXmlObject } {
    const entries = Object.entries(xmlObj);
    // filter out entries of non-elements
    const withoutPI = entries.filter(([key, val]) => !key.startsWith('?'));
    const withoutComments = withoutPI.filter(([key, val]) => key !== '_cmt'); //TODO do it in XmlParser? this option needs to be in sync with there
    if (withoutComments.length !== 1) {
        throw new Error('XML object contains multiple or no root elements');
    }
    // get and check root value
    const [rootKey, rootValAny] = withoutComments[0];
    const rootVal = rootValAny as unknown;
    if (typeof rootVal !== 'object' || rootVal === null) {
        throw new Error('XML root element is not an object');
    }
    return { name: rootKey, value: rootVal };
}