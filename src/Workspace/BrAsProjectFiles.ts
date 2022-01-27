/**
 * Access to B&R specific project files
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import * as xmlbuilder2 from 'xmlbuilder2';
import * as xmlDom from '@oozcitak/dom/lib/dom/interfaces';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import * as Helpers from '../Tools/Helpers';
import { logger } from '../Tools/Logger';





//#region exported interfaces


/**
 * The AS XML processing instruction containing file and project versions
 */
export interface XmlHeader {
    /** Full Automation Studio version in XML header */
    asVersion?: string;
    /** Automation Studio working version in XML header (X.Y e.g. 4.9) */
    asWorkingVersion?: string;
    /** Automation Studio file version in XML header */
    asFileVersion?: string;
}


/**
 * Contains information from the AS project file (*.apj)
 */
export interface ProjectFileInfo {
    /** Automation Studio version used in the project file */
    header: XmlHeader;
    /** Description of the project */
    description?: string;
}


/**
 * Contains information from project user settings (LastUser.set, <username>.set)
 */
export interface UserSettingsInfo {
    /** Automation Studio version used in the file */
    header: XmlHeader;
    /** Name of the active configuration */
    activeConfiguration?: string;
    /** Deployment target for newly added programs (e.g. active configuration) */
    deploymentTarget?: string;
}

//#endregion exported interfaces


//#region exported functions


/**
 * Gets information from a specified project file (*.apj)
 * @param projectFile URI to the AS project file
 */
export async function getProjectFileInfo(projectFile: vscode.Uri): Promise<ProjectFileInfo | undefined> {
    // getting of basic XML content
    const xmlBase = await xmlCreateFromUri(projectFile);
    if (!xmlBase) {
        logger.error(`File '${projectFile.fsPath}' does not exist or is no valid XML file`);
        return undefined;
    }
    const xmlHeader = getXmlHeader(xmlBase);
    if ( (!xmlHeader.asVersion) && (!xmlHeader.asWorkingVersion) ) {
        logger.error(`Invalid file ${projectFile.fsPath}: Failed to parse AS Version or WorkingVersion`);
        return undefined;
    }
    const rootElement = getRootElement(xmlBase, 'Project');
    if (!rootElement) {
        logger.error(`Invalid file ${projectFile.fsPath}: No XML root element with name <Project> found`);
        return undefined;
    }
    // get data from the project root
    const description = rootElement.getAttribute('Description') ?? undefined;
    // return info data
    return {
        header: xmlHeader,
        description: description
    };
}


/**
 * Gets information from a specified user settings file.
 * @param settingsFile URI to the user settings file (*.set)
 */
export async function getUserSettingsInfo(settingsFile: vscode.Uri): Promise<UserSettingsInfo | undefined> {
    // getting of basic XML content
    const xmlBase = await xmlCreateFromUri(settingsFile);
    if (!xmlBase) {
        logger.debug(`BrAsProjectFiles.getUserSettingsInfo(settingsFile) -> (!xmlBase)`, { settingsFile: settingsFile.toString(true) });
        return undefined;
    }
    const xmlHeader = getXmlHeader(xmlBase);
    const rootElement = getRootElement(xmlBase, 'ProjectSettings');
    if (!rootElement) {
        logger.debug(`BrAsProjectFiles.getUserSettingsInfo(settingsFile) -> (!rootElement)`, { settingsFile: settingsFile.toString(true) });
        return undefined;
    }
    // get active configuration
    const configMngElement = getChildElements(rootElement, 'ConfigurationManager').pop();
    const activeConfiguration = configMngElement?.getAttribute('ActiveConfigurationName') ?? undefined;
    // get deployment target
    const deploymentElement = getChildElements(rootElement, 'Deployment').pop();
    const deploymentTarget = deploymentElement?.getAttribute('Value') ?? undefined;
    // return info data
    return {
        header: xmlHeader,
        activeConfiguration: activeConfiguration,
        deploymentTarget: deploymentTarget
    };
}


//#endregion exported functions


//#region local functions


/**
 * Creates an XMLBuilder from an XML file URI.
 * @param fileUri URI to the XML file
 * @returns The `XMLBuilder` for the file or `undefined` if an error occurs
 */
async function xmlCreateFromUri(fileUri: vscode.Uri): Promise<XMLBuilder | undefined> {
    try {
        const projectDocument = await vscode.workspace.openTextDocument(fileUri);
        const contentText = projectDocument.getText();
        return xmlbuilder2.create(contentText);
    } catch (error) {
        logger.debug('BrAsProjectFiles.xmlCreateFromUri(fileUri) -> catch (error)', { fileUri: fileUri.toString(true) });
        return undefined;
    }
}


/**
 * Gets the AutomationStudio XML processing instruction containing file and project versions
 * @param xmlBase The base XMLBuilder
 */
function getXmlHeader(xmlBase: XMLBuilder): XmlHeader {
    const asHeaderNode = xmlBase.find((child) => {
        const node = child.node;
        if (node.nodeType === node.PROCESSING_INSTRUCTION_NODE) {
            return (node.nodeName === 'AutomationStudio');
        }
        return false;
    })?.node;
    const asHeaderData = asHeaderNode?.nodeValue ? ` ${asHeaderNode.nodeValue}` : '';
    // AS version full
    const asVersionRegEx = /^.*[ \t]+[Vv]ersion=["']*([\d\.]+).*$/m.exec(asHeaderData);
    const asVersion = asVersionRegEx ? asVersionRegEx[1] : undefined;
    // AS working version
    const asWorkingVersionRegEx = /^.*[ \t]+WorkingVersion="([\d\.]+)".*$/m.exec(asHeaderData);
    const asWorkingVersion = asWorkingVersionRegEx ? asWorkingVersionRegEx[1] : undefined;
    // AS file version
    const asFileVersionRegEx = /^.*[ \t]+FileVersion="([\d\.]+)".*$/m.exec(asHeaderData);
    const asFileVersion = asFileVersionRegEx ? asFileVersionRegEx[1] : undefined;
    // return value
    return {
        asVersion: asVersion,
        asWorkingVersion: asWorkingVersion,
        asFileVersion: asFileVersion,
    };
}


/**
 * Gets the root element of the XMLBuilder
 * @param xmlBase the XMLBuilder of the document
 * @param requiredName If specified, the root element needs to match this name
 */
function getRootElement(xmlBase: XMLBuilder, requiredName?: string): xmlDom.Element | undefined {
    try {
        const rootElement = xmlBase.root().node as xmlDom.Element;
        if (requiredName) {
            return (rootElement.nodeName === requiredName) ? rootElement : undefined;
        }
        return rootElement;
    } catch (error) {
        return undefined;
    }
}


/**
 * Gets all direct children of an XML element node which are also element nodes. Filters can be applied.
 * @param baseElement The base XML element node for which the children are listed.
 * @param nodeName If set, only child elements with the specified name are returned
 * @param hasAttribute If set, only child elements which have the specified attribute name (and value if set) are returned
 */
function getChildElements(baseElement: xmlDom.Element, nodeName?: string, hasAttribute?: {name: string, value?: string}): xmlDom.Element[] {
    // TODO const result = rootElement.querySelector() // not yet implemented by 'dom' module, so I implemented my own solution getChildElements()
    const result: xmlDom.Element[] = [];
    // iterate all child elements
    let nextChild = baseElement.firstElementChild;
    while (nextChild) {
        // iterate
        const actChild = nextChild;
        nextChild = actChild.nextElementSibling;
        // check name
        if (nodeName) {
            if (actChild.nodeName !== nodeName) {
                continue;
            }
        }
        // check attribute
        if (hasAttribute) {
            const attrVal = actChild.getAttribute(hasAttribute.name);
            if (!attrVal) {
                continue;
            }
            if (hasAttribute.value && hasAttribute.value !== attrVal) {
                continue;
            }
        }
        result.push(actChild);
    }
    return result;
}


/**
 * Split a raw build options string into separate parts
 * @param rawOptions Raw option string from configuration file
 * @returns An array with all the build options separated
 */
function splitBuildOptions(rawOptions: string | undefined): string[] {
    // directly return for empty options
    if ((!rawOptions) || (rawOptions.length === 0)) {
        return [];
    }
    const options = rawOptions.split(/\s/gm);
    return options;
}


/**
 * Transforms a project relative or absolute Windows path as used in AS configuration files to a
 * relative or absolute URI path without scheme...
 * @param projectPath Path relative to AS project or absolute Windows path
 * @returns A relative or absolute URI path to the file
 */
function projectPathToUriPath(projectPath: string): string {
    const isRelative = projectPath.startsWith('\\');
    if (isRelative) {
        const posixPath = './' + projectPath.substr(1).split('\\').join('/');
        return posixPath;
    } else {
        return vscode.Uri.file(projectPath).path;
    }
}


function projectPathsToUriPaths(projectPaths: string[] | undefined): string[] {
    if ((!projectPaths) || (projectPaths.length === 0)) {
        return [];
    }
    return projectPaths.map((prjPath) => projectPathToUriPath(prjPath));
}


//#endregion local functions