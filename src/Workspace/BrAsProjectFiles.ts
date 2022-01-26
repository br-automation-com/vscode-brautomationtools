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
 * Contains information from a physical package file (Physical.pkg)
 */
export interface PhysicalPackageInfo {
    /** Automation Studio version used in the file */
    header: XmlHeader;
    /** Configurations within the package file */
    configurations: {
        relativePath: string;
        description?: string;
    }[];
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


/**
 * Contains information from CPU package of the configuration (Cpu.pkg)
 */
export interface CpuPackageInfo {
    /** Automation Studio version used in the file */
    header: XmlHeader;
    /** Automation Runtime version used in the configuration */
    arVersion?: string;
    /** Module ID of the CPU module */
    cpuModuleId?: string;
    /** Configurations for build */
    build: {
        /** Used gcc version */
        gccVersion?: string;
        /** General additional build options */
        additionalBuildOptions: string[];
        /** Additional build options for ANSI C programs */
        ansiCAdditionalBuildOptions: string[];
        /** Additional build options for IEC programs */
        iecAdditionalBuildOptions: string[];
        /** ANSI C include directories as paths in posix style (absolute or relative to AS project base) */
        ansiCIncludeDirectories: string[];
    }
}


/**
 * Contains information from the root package of the configuration (Config.pkg)
 */
export interface ConfigPackageInfo {
    /** Automation Studio version used in the file */
    header: XmlHeader;
    /** Name of the CPU package (package which contains most files of the configuration) */
    cpuPackageName: string;
    /** Description of the CPU package */
    cpuPackageDescription?: string;
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
 * Gets information from a specified physical package file.
 * @param physicalPackageFile URI to the Physical.pkg
 */
export async function getPhysicalPackageInfo(physicalPackageFile: vscode.Uri): Promise<PhysicalPackageInfo | undefined> {
    // getting of basic XML content
    const xmlBase = await xmlCreateFromUri(physicalPackageFile);
    if (!xmlBase) {
        logger.error(`File '${physicalPackageFile.fsPath}' does not exist or is no valid XML file`);
        return undefined;
    }
    const xmlHeader = getXmlHeader(xmlBase);
    const rootElement = getRootElement(xmlBase, 'Physical');
    if (!rootElement) {
        logger.error(`Invalid file ${physicalPackageFile.fsPath}: No XML root element with name <Physical> found`);
        return undefined;
    }
    // get configurations
    const objectsElement = getChildElements(rootElement, 'Objects');
    if (objectsElement.length === 0) {
        logger.error(`Invalid file ${physicalPackageFile.fsPath}: No <Objects> elements found`);
        return undefined;
    }
    const configElements = getChildElements(objectsElement[0], 'Object', {name: 'Type', value: 'Configuration'});
    const configDataRaw = configElements.map((element) => {
        const description = element.getAttribute('Description') ?? undefined;
        const relativePath = element.textContent ?? undefined;
        if (relativePath) {
            return {relativePath: relativePath, description: description};
        }
    });
    const configData: {relativePath: string, description?: string}[] = [];
    Helpers.pushDefined(configData, ...configDataRaw);
    // return info data
    return {
        header: xmlHeader,
        configurations: configData
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


/**
 * Gets information from a specified CPU package file.
 * @param cpuFile URI to the CPU package file (Cpu.pkg)
 */
export async function getCpuPackageInfo(cpuFile: vscode.Uri): Promise<CpuPackageInfo | undefined> {
    // getting of basic XML content
    const xmlBase = await xmlCreateFromUri(cpuFile);
    if (!xmlBase) {
        logger.error(`File '${cpuFile.fsPath}' does not exist or is no valid XML file`);
        return undefined;
    }
    const xmlHeader = getXmlHeader(xmlBase);
    const rootElement = getRootElement(xmlBase, 'Cpu');
    if (!rootElement) {
        logger.error(`Invalid file ${cpuFile.fsPath}: No XML root element with name <Cpu> found`);
        return undefined;
    }
    const configElement = getChildElements(rootElement, 'Configuration').pop();
    if (!configElement) {
        logger.error(`Invalid file ${cpuFile.fsPath}: No <Configuration> element found`);
        return undefined;
    }
    // Get CPU module ID
    const cpuModuleId = configElement.getAttribute('ModuleId') ?? undefined;
    if (!cpuModuleId) {
        logger.warning(`Failed to get ModuleId from CPU package file '${cpuFile.fsPath}'`);
    }
    // get Automation Runtime configuration values
    const arConfigElement = getChildElements(configElement, 'AutomationRuntime').pop();
    const arVersion = arConfigElement?.getAttribute('Version') ?? undefined;
    if (!arVersion) {
        logger.warning(`Failed to get AR version from CPU package file '${cpuFile.fsPath}'`);
    }
    // get build configuration values
    const buildConfigElement = getChildElements(configElement, 'Build').pop();
    const gccVersion = buildConfigElement?.getAttribute('GccVersion') ?? undefined;
    const additionalBuildOptionsRaw = buildConfigElement?.getAttribute('AdditionalBuildOptions') ?? undefined;
    const additionalBuildOptions = splitBuildOptions(additionalBuildOptionsRaw);
    const ansiCAdditionalBuildOptionsRaw = buildConfigElement?.getAttribute('AnsicAdditionalBuildOptions') ?? undefined;
    const ansiCAdditionalBuildOptions = splitBuildOptions(ansiCAdditionalBuildOptionsRaw);
    const iecAdditionalBuildOptionsRaw = buildConfigElement?.getAttribute('IecAdditionalBuildOptions') ?? undefined;
    const iecAdditionalBuildOptions = splitBuildOptions(iecAdditionalBuildOptionsRaw);
    const ansiCIncludeDirectoriesRaw = buildConfigElement?.getAttribute('AnsicIncludeDirectories')?.split(',');
    const ansiCIncludeDirectories = projectPathsToUriPaths(ansiCIncludeDirectoriesRaw);
    // return info data
    return {
        header:   xmlHeader,
        arVersion:   arVersion,
        cpuModuleId: cpuModuleId,
        build: {
            gccVersion:                  gccVersion,
            additionalBuildOptions:      additionalBuildOptions,
            ansiCAdditionalBuildOptions: ansiCAdditionalBuildOptions,
            iecAdditionalBuildOptions:   iecAdditionalBuildOptions,
            ansiCIncludeDirectories:     ansiCIncludeDirectories
        }
    };
}


/**
 * Gets information from a specified configuration package file.
 * @param configPackageFile URI to the Config.pkg
 */
export async function getConfigPackageInfo(configPackageFile: vscode.Uri): Promise<ConfigPackageInfo | undefined> {
    // getting of basic XML content
    const xmlBase = await xmlCreateFromUri(configPackageFile);
    if (!xmlBase) {
        logger.error(`File '${configPackageFile.fsPath}' does not exist or is no valid XML file`);
        return undefined;
    }
    const xmlHeader = getXmlHeader(xmlBase);
    const rootElement = getRootElement(xmlBase, 'Configuration');
    if (!rootElement) {
        logger.error(`Invalid file ${configPackageFile.fsPath}: No XML root element with name <Configuration> found`);
        return undefined;
    }
    // get CPU objects (<Object Type="Cpu">)
    const objectsElement = getChildElements(rootElement, 'Objects');
    if (objectsElement.length === 0) {
        logger.error(`Invalid file ${configPackageFile.fsPath}: No <Objects> elements found`);
        return undefined;
    }
    const cpuElements = getChildElements(objectsElement[0], 'Object', {name: 'Type', value: 'Cpu'});
    if (cpuElements.length !== 1) {
        logger.error(`Invalid file ${configPackageFile.fsPath}: None or multiple Cpu elements (<Object Type="Cpu">) found. Number of elements: ${cpuElements.length}`);
        return undefined;
    }
    const cpuElement = cpuElements[0];
    const cpuPackageName = cpuElement.textContent ?? undefined;
    const cpuPackageDescription = cpuElement.getAttribute('Description') ?? undefined;
    if (!cpuPackageName) {
        logger.error(`Invalid file ${configPackageFile.fsPath}: CPU Object element is empty`);
        return undefined;
    }
    return {
        header:             xmlHeader,
        cpuPackageName:        cpuPackageName,
        cpuPackageDescription: cpuPackageDescription
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
    const asVersionRegEx = /^.*[ \t]+[Vv]ersion=["']*([\d\.]+).*$/gm.exec(asHeaderData);
    const asVersion = asVersionRegEx ? asVersionRegEx[1] : undefined;
    // AS working version
    const asWorkingVersionRegEx = /^.*[ \t]+WorkingVersion="([\d\.]+)".*$/gm.exec(asHeaderData);
    const asWorkingVersion = asWorkingVersionRegEx ? asWorkingVersionRegEx[1] : undefined;
    // AS file version
    const asFileVersionRegEx = /^.*[ \t]+FileVersion="([\d\.]+)".*$/gm.exec(asHeaderData);
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