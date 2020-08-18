/**
 * Access to B&R specific project files
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import * as xmlbuilder2 from 'xmlbuilder2';
import * as xmlDom from '@oozcitak/dom/lib/dom/interfaces';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import * as Helpers from './Tools/Helpers';


// TODO const result = rootElement.querySelector() // not yet implemented by 'dom' module, so I implemented my own solution getChildElements()


//#region exported interfaces


/**
 * Contains information from the AS project file (*.apj)
 */
export interface ProjectFileInfo {
    /** Automation Studio version used in the project file */
    asVersion: string;
    /** Description of the project */
    description?: string;
}


/**
 * Contains information from a physical package file (Physical.pkg)
 */
export interface PhysicalPackageInfo {
    /** Automation Studio version used in the file */
    asVersion: string;
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
    asVersion: string;
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
    asVersion: string;
    /** Automation Runtime version used in the configuration */
    arVersion: string;
    /** Configurations for build */
    build?: {
        /** Used gcc version */
        gccVersion?: string;
        /** General additional build options */
        additionalBuildOptions?: string;
        /** Additional build options for ANSI C programs */
        ansiCAdditionalBuildOptions?: string;
        /** Additional build options for IEC programs */
        iecAdditionalBuildOptions?: string;
        /** ANSI C include directories as paths in posix style (absolute or relative to AS project base) */
        ansiCIncludeDirectories?: string[];
    }
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
        return undefined;
    }
    const asVersion = getAsVersionFromXml(xmlBase);
    if (!asVersion) {
        return undefined;
    }
    const rootElement = getRootElement(xmlBase, 'Project');
    if (!rootElement) {
        return undefined;
    }
    // get data from the project root
    const description = rootElement.getAttribute('Description') ?? undefined;
    console.log(description);
    // return info data
    return {
        asVersion: asVersion,
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
        return undefined;
    }
    const asVersion = getAsVersionFromXml(xmlBase);
    if (!asVersion) {
        return undefined;
    }
    const rootElement = getRootElement(xmlBase, 'Physical');
    if (!rootElement) {
        return undefined;
    }
    // get configurations
    const objectsElement = getChildElements(rootElement, 'Objects');
    if (objectsElement.length === 0) {
        return undefined;
    }
    const configElements = getChildElements(objectsElement[0], 'Object', {name: 'Type', value: 'Configuration'});
    const configDataRaw = configElements.map(element => {
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
        asVersion: asVersion,
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
        return undefined;
    }
    const asVersion = getAsVersionFromXml(xmlBase);
    if (!asVersion) {
        return undefined;
    }
    const rootElement = getRootElement(xmlBase, 'ProjectSettings');
    if (!rootElement) {
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
        asVersion: asVersion,
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
        return undefined;
    }
    const asVersion = getAsVersionFromXml(xmlBase);
    if (!asVersion) {
        return undefined;
    }
    const rootElement = getRootElement(xmlBase, 'Cpu');
    if (!rootElement) {
        return undefined;
    }
    const configElement = getChildElements(rootElement, 'Configuration').pop();
    if (!configElement) {
        return undefined;
    }
    // get Automation Runtime configuration values
    const arConfigElement = getChildElements(configElement, 'AutomationRuntime').pop();
    const arVersion = arConfigElement?.getAttribute('Version') ?? undefined;
    if (!arVersion) {
        return undefined;
    }
    // get build configuration values
    const buildConfigElement = getChildElements(configElement, 'Build').pop();
    const gccVersion                  = buildConfigElement?.getAttribute('GccVersion') ?? undefined;
    const additionalBuildOptions      = buildConfigElement?.getAttribute('AdditionalBuildOptions') ?? undefined;
    const ansiCAdditionalBuildOptions = buildConfigElement?.getAttribute('AnsicAdditionalBuildOptions') ?? undefined;
    const iecAdditionalBuildOptions   = buildConfigElement?.getAttribute('IecAdditionalBuildOptions') ?? undefined;
    const ansiCIncludeDirectoriesRaw  = buildConfigElement?.getAttribute('AnsicIncludeDirectories')?.split(',');
    const ansiCIncludeDirectories     = ansiCIncludeDirectoriesRaw?.map(winPath => {
        const isRelative = winPath.startsWith('\\');
        if (isRelative) {
            const posixPath = './' + winPath.substr(1).replace('\\', '/');
            return posixPath;
        } else {
            return vscode.Uri.file(winPath).path;
        }
    });
    // return info data
    return {
        asVersion: asVersion,
        arVersion: arVersion,
        build: {
            gccVersion:                  gccVersion,
            additionalBuildOptions:      additionalBuildOptions,
            ansiCAdditionalBuildOptions: ansiCAdditionalBuildOptions,
            iecAdditionalBuildOptions:   iecAdditionalBuildOptions,
            ansiCIncludeDirectories:     ansiCIncludeDirectories
        }
    };
}


//#endregion exported functions


//#region local functions


/**
 * Creates an XMLBuilder from an XML file URI.
 * @param fileUri URI to the XML file
 * @returns `undefined` if an error occurs
 */
async function xmlCreateFromUri(fileUri: vscode.Uri): Promise<XMLBuilder | undefined> {
    try {
        const projectDocument = await vscode.workspace.openTextDocument(fileUri);
        const contentText = projectDocument.getText();
        return xmlbuilder2.create(contentText);
    } catch (error) {
        console.log(error);
        return undefined;
    }
}


/**
 * Gets the AS version from the XML processing instruction `<?AutomationStudio Version=4.6.5.78 SP?>` or `<?AutomationStudio Version="4.6.5.78 SP"?>`
 * @param xmlBase The base XMLBuilder
 */
function getAsVersionFromXml(xmlBase: XMLBuilder): string | undefined {
    const asVersionNode = xmlBase.find(child => {
        const node = child.node;
        if (node.nodeType === node.PROCESSING_INSTRUCTION_NODE) {
             return (node.nodeName === 'AutomationStudio');
        }
        return false;
    })?.node;
    const asVersionData = asVersionNode?.nodeValue;
    const regExpResult = new RegExp(`^[Vv]ersion=["']*([\\d\\.]+).*$`).exec(asVersionData ?? '');
    const asVersion = regExpResult ? regExpResult[1] : undefined;
    return asVersion;
}


/**
 * Gets the root element of the XMLBuilder
 * @param xmlBase the XMLBuilder of the document
 * @param requiredName If specified, the root element needs to match this name
 */
function getRootElement(xmlBase: XMLBuilder, requiredName?: string): xmlDom.Element | undefined
{
    try {
        const rootElement = xmlBase.root().node as xmlDom.Element;
        if (requiredName) {
            return (rootElement.nodeName === requiredName) ? rootElement : undefined;
        }
        return rootElement;
    } catch (error) {
        console.log(error);
        return undefined;
    }
}


/**
 * Gets all children of an XML element node which are also element nodes. Filters can be applied.
 * @param baseElement The base XML element nod for which the children are listed.
 * @param nodeName 
 * @param hasAttribute 
 */
function getChildElements(baseElement: xmlDom.Element, nodeName?: string, hasAttribute?: {name: string, value?: string}): xmlDom.Element[] {
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


//#endregion local functions