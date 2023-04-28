import * as vscode from "vscode";
import { Uri } from "vscode";
import { createFile, replaceAllTextInFile } from "../../Tools/FileTools";
import { logger } from "../../Tools/Logger";
import { AsXmlBuilder, AsXmlParser, ParsedXmlObject } from "./AsXmlParser";
import { withoutUndefined } from "../../Tools/Helpers";

/**
 * The Automation Studio XML processing instruction data containing file and project versions
 */
export interface AsXmlVersionHeader {
    /** Full Automation Studio version in XML header */
    asVersion?: string;
    /** Automation Studio working version in XML header (X.Y e.g. 4.9) */
    asWorkingVersion?: string;
    /** Automation Studio file version in XML header */
    asFileVersion?: string;
}

/**
 * Representation of a simple Automation Studio XML file. Can be extended for specialized Automation Studio Files
 */
export class AsXmlFile {
    /**
     * Automation Studio XML file representation from a specified file path
     * @param filePath The path to the XML file. e.g. `C:\Projects\Test\Logical\MyFolder\Package.pkg` or `C:\Projects\Test\Logical\MyLib\ANSIC.lby`
     * @returns The Automation Studio XML file representation which was parsed from the file
     */
    public static async createFromFile(filePath: Uri): Promise<AsXmlFile | undefined> {
        // Create and initialize object
        try {
            const textDoc = await vscode.workspace.openTextDocument(filePath);
            const fileContent = textDoc.getText();
            return new AsXmlFile(filePath, fileContent);
        } catch (error) {
            logger.error(`Failed to read XML file from path ${logger.formatUri(filePath)}. ${logger.formatError(error)}`);
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
    public toJSON(): Record<string, unknown> {
        return {
            filePath: this.filePath.toString(true),
            versionHeader: this.versionHeader,
            xmlObj: this.xmlObj,
        };
    }

    /** Get the XML representation of the file */
    public toXml(): string {
        const filtered = withoutUndefined(this.#xmlObj); // filter to prevent writing undefined values (e.g. <?AutomationStudio Version="6.3.5.44 UP" WorkingVersion="undefined" FileVersion="undefined"?>)
        const builder = new AsXmlBuilder();
        return builder.build(filtered as object);
    }

    /**
     * Write an XML file from the object contents
     * @param filePath The path to the file which should be written. If omitted, `this.filePath` is used.
     * @returns A promise which resolves to true on success
     */
    public async writeToFile(filePath: Uri = this.filePath): Promise<boolean> {
        if (!this.checkWriteToFilePossible()) return false;
        const xml = this.toXml();
        await createFile(filePath, { ignoreIfExists: true }); // keep existing so the encoding and newline settings are kept by VS code
        return await replaceAllTextInFile(filePath, xml);
    }

    /**
     * Checks if writing the file is possible and allowed. If writing is not allowed the reason is logged.
     * @returns `true` if writing the file is possible, false otherwise.
     */
    protected checkWriteToFilePossible(): boolean {
        // Check for legacy PI version header
        if (this.#hasLegacyVersionHeader()) {
            logger.warning(`File ${logger.formatUri(this.filePath)} has unsupported legacy file format and cannot be modified`);
            return false;
        }
        // all check passed -> writable
        return true;
    }

    #hasLegacyVersionHeader(): boolean {
        const hasAsVersion = this.versionHeader.asVersion !== undefined && this.versionHeader.asVersion !== "";
        const hasFileVersion = this.versionHeader.asFileVersion !== undefined && this.versionHeader.asFileVersion !== "";
        const hasWorkingVersion = this.versionHeader.asWorkingVersion !== undefined && this.versionHeader.asWorkingVersion !== "";
        return !hasAsVersion && !hasFileVersion && !hasWorkingVersion;
    }
}

/**
 * Get all existing version information from the AutomationStudio XML processing instruction header
 */
function getXmlVersionHeader(xmlObj: ParsedXmlObject): AsXmlVersionHeader {
    //TODO currently does not work with old PI of AS version (not in attribute syntax)
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const xmlAny = xmlObj as any; //HACK to access by indexer. find out how to solve properly?
    const versionObj = xmlAny?.["?AutomationStudio"]?._att;
    const asVersion = versionObj?.Version as unknown;
    const asWorkingVersion = versionObj?.WorkingVersion as unknown;
    const asFileVersion = versionObj?.FileVersion as unknown;
    /* eslint-enable */
    // return value
    return {
        asVersion: typeof asVersion === "string" ? asVersion : undefined,
        asWorkingVersion: typeof asWorkingVersion === "string" ? asWorkingVersion : undefined,
        asFileVersion: typeof asFileVersion === "string" ? asFileVersion : undefined,
    };
}

/**
 * Change the XML version information header to new data
 */
function setXmlVersionHeader(xmlObj: ParsedXmlObject, versionHeader: AsXmlVersionHeader): void {
    // add attribute object to PI node
    if ("?AutomationStudio" in xmlObj) {
        xmlObj["?AutomationStudio"] = {
            /* eslint-disable @typescript-eslint/naming-convention */
            _att: {
                Version: versionHeader.asVersion,
                WorkingVersion: versionHeader.asWorkingVersion,
                FileVersion: versionHeader.asFileVersion,
            },
            /* eslint-enable */
        };
    } else {
        logger.warning("Could not set B&R XML version data, as the PI node <?AutomationStudio> was not found");
    }
}

function getXmlRootData(xmlObj: ParsedXmlObject): { name: string; value: ParsedXmlObject } {
    const entries = Object.entries(xmlObj);
    // filter out entries of non-elements
    const withoutPI = entries.filter(([key, val]) => !key.startsWith("?"));
    const withoutComments = withoutPI.filter(([key, val]) => key !== "_cmt"); //TODO do it in XmlParser? this option needs to be in sync with there
    if (withoutComments.length !== 1) {
        throw new Error("XML object contains multiple or no root elements");
    }
    // get and check root value
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const [rootKey, rootValAny] = withoutComments[0];
    const rootVal = rootValAny as unknown;
    if (typeof rootVal !== "object" || rootVal === null) {
        throw new Error("XML root element is not an object");
    }
    /* eslint-enable */
    return { name: rootKey, value: rootVal };
}
