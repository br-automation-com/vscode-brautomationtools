import * as xmlDom from '@oozcitak/dom/lib/dom/interfaces';
import * as vscode from 'vscode';
import * as xmlbuilder2 from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';

/**
 * The Automation Studio XML processing instruction data containing file and project versions
 */
export interface AsXmlHeader {
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
export abstract class AsXmlFile {

    /** Object is not ready to use after constructor due to async operations,
     * _initialize() has to be called for the object to be ready to use! */
    protected constructor(filePath: vscode.Uri) {
        this.#filePath = filePath;
        // other properties rely on async and will be initialized in #initialize()
    }

    /**
     * Async operations to finalize object construction
     * @throws If a required initialization process failed
     */
    protected async _initialize(): Promise<void> {
        const builder = await createXmlBuilder(this.#filePath);
        this.#header = getXmlHeader(builder);
        this.#rootElement = getRootElement(builder);
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** Path to the source file */
    public get filePath(): vscode.Uri {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized ${AsXmlFile.name} object`); }
        return this.#filePath;
    }
    #filePath: vscode.Uri;

    /** The Automation Studio XML header data */
    public get header(): AsXmlHeader {
        if (!this.#isInitialized || !this.#header) { throw new Error(`Use of not initialized ${AsXmlFile.name} object`); }
        return this.#header;
    }
    #header: AsXmlHeader | undefined;

    /** The root element node of the XML file */
    protected get rootElement(): xmlDom.Element {
        if (!this.#isInitialized || !this.#rootElement) { throw new Error(`Use of not initialized ${AsXmlFile.name} object`); }
        return this.#rootElement;
    }
    #rootElement: xmlDom.Element | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            filePath: this.filePath.toString(true),
            header: this.header,
        };
    }
}

/**
 * Creates an XMLBuilder from a file path.
 * @throws If reading of file or creating of XMLBuilder failed
 */
async function createXmlBuilder(filePath: vscode.Uri): Promise<XMLBuilder> {
    try {
        const projectDocument = await vscode.workspace.openTextDocument(filePath);
        const contentText = projectDocument.getText();
        return xmlbuilder2.create(contentText);
    } catch (error) {
        throw new Error('File does not exist or is no XML file');
    }
}

/**
 * Get all existing version information from the AutomationStudio XML processing instruction header
 */
function getXmlHeader(xml: XMLBuilder): AsXmlHeader {
    const asHeaderNode = xml.find((child) => {
        const node = child.node;
        if (node.nodeType === node.PROCESSING_INSTRUCTION_NODE) {
            return (node.nodeName === 'AutomationStudio');
        }
        return false;
    })?.node;
    const asHeaderData = asHeaderNode?.nodeValue ? ` ${asHeaderNode.nodeValue}` : ''; // Add space at begin for easier RegEx
    // AS version full
    const asVersionMatch = /^.*[ \t]+[Vv]ersion=["']*([\d\.]+).*$/m.exec(asHeaderData);
    const asVersion = asVersionMatch ? asVersionMatch[1] : undefined;
    // AS working version
    const asWorkingVersionMatch = /^.*[ \t]+WorkingVersion="([\d\.]+)".*$/m.exec(asHeaderData);
    const asWorkingVersion = asWorkingVersionMatch ? asWorkingVersionMatch[1] : undefined;
    // AS file version
    const asFileVersionMatch = /^.*[ \t]+FileVersion="([\d\.]+)".*$/m.exec(asHeaderData);
    const asFileVersion = asFileVersionMatch ? asFileVersionMatch[1] : undefined;
    // return value
    return {
        asVersion: asVersion,
        asWorkingVersion: asWorkingVersion,
        asFileVersion: asFileVersion,
    };
}

/**
 * Gets the XML root element
 * @throws If no root node was found or if root node is not of type element
 */
function getRootElement(xml: XMLBuilder): xmlDom.Element {
    try {
        const rootNode = xml.root().node;
        if (rootNode.nodeType === xmlDom.NodeType.Element) {
            return rootNode as xmlDom.Element;
        } else {
            throw new Error('Root node type is not Element');
        }
    } catch (error) {
        throw new Error('Failed to get root node');
    }
}