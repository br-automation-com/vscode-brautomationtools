/**
 * Receive information for the AS projects within the workspaces
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import * as BrAsProjectFiles from './BrAsProjectFiles';
import * as uriTools from './Tools/UriTools';


//#region exported types


/**
 * Information for an AS project
 */
export interface AsProjectInfo {
    /** Name of the AS project */
    name: string;
    /** Description of the AS project */
    description?: string;
    /** AS version used in the project */
    asVersion: string;
    /** Absolute URI to the project base directory */
    baseUri: vscode.Uri,
    /** Absolute URI to the project file (*.apj) */
    projectFile: vscode.Uri,
    /** Absolute URI to the Logical directory */
    logical: vscode.Uri,
    /** Absolute URI to the Physical directory */
    physical: vscode.Uri,
    /** Absolute URI to the temporary directory */
    temporary: vscode.Uri,
    /** Absolute URI to the temporary includes directory */
    temporaryIncludes: vscode.Uri
    /** Information for all configurations within this project */
    configurations: AsConfigurationInfo[];
}


/**
 * Information for a configuration within an AS project
 */
export interface AsConfigurationInfo {
    /** Name of the configuration */
    name: string;
    /** Description of the configuration */
    description?: string;
    /** Absolute URI to the configuration base directory */
    baseUri: vscode.Uri;
}


//#endregion exported types


//#region exported functions


/**
 * Activation of AS project workspace
 * @param context context to register disposables
 */
export async function registerProjectWorkspace(context: vscode.ExtensionContext) {
    updateWorkspaceProjects();
    // register to update on change of workspace folders
    let disposable: vscode.Disposable;
    disposable = vscode.workspace.onDidChangeWorkspaceFolders(() => updateWorkspaceProjects());
    context.subscriptions.push(disposable);
}


/**
 * Get all AS project data within the workspace folders.
 */
export async function getWorkspaceProjects(): Promise<AsProjectInfo[]> {
    return await _workspaceProjects;
}


/**
 * Update all AS project data within the workspace folders.
 * @returns The number of projects found within the workspace folders.
 */
export async function updateWorkspaceProjects(): Promise<Number> {
    _workspaceProjects = findAsProjectInfo();
    return (await _workspaceProjects).length;
}


/**
 * Gets the AS project to which the given URI belongs.
 * @param uri URI which is checked to be within a project
 * @returns `undefined` if no AS project was found for the given URI.
 */
export async function getProjectForUri(uri: vscode.Uri): Promise<AsProjectInfo | undefined> {
    // get projects
    const projects = await getWorkspaceProjects();
    // sort projects so the longest path is first -> when an AS project is within an AS project the right one is found
    const projectsSorted = projects.sort((a, b) => (b.baseUri.path.length - a.baseUri.path.length));
    return projectsSorted.find(p => uriTools.isSubOf(p.baseUri, uri));
}


/**
 * Gets the active configuration of an AS project
 */
export async function getActiveConfiguration(asProject: AsProjectInfo): Promise<AsConfigurationInfo | undefined> {
    //TODO implement
    return undefined;
}


/**
 * Gets the header include directories for a code file within an AS projects logical directory.
 * @param codeFile A URI to the code file to get the header includes for
 */
export async function getProjectHeaderIncludeDirs(codeFile: vscode.Uri): Promise<vscode.Uri[]> {
    const project = await getProjectForUri(codeFile);
    // check requirements to provide header include directories
    if (!project) {
        return [];
    }
    if (!uriTools.isSubOf(project.logical, codeFile)) {
        return [];
    }
    if (!await uriTools.isFile(codeFile)) {
        return [];
    }
    // get headers for program or library code files
    if (await isInLibrary(project, codeFile)) {
        return getHeaderIncludeDirsForLibrary(project, codeFile);
    } else {
        //TODO isInProgram(project, codeFile) -> no special includes otherwise
        return getHeaderIncludeDirsForProgram(project, codeFile);
    }
    //TODO get standard headers also here?
}


//#endregion exported functions


//#region local variables


/** An array containing all project information within the workspace folders. */
//TODO put functionality in a class to save state, or are local variables like this OK?
let _workspaceProjects: Promise<AsProjectInfo[]> = findAsProjectInfo();


//#endregion local variables


//#region local types


/** The type of an URI object within the Automation Studio context */
enum ProjectUriType {
    /** The URI is undefined in context of the AS project  */
    Undefined,
    /** The URI is the base directory of an AS project */
    ProjectBaseDirectory,
    /** The URI is the project file of an AS project */
    ProjectFile,
    /** The URI is the root directory of the logical contents */
    LogicalRootDirectory,
    /** The URI is the root directory of the physical contents */
    PhysicalRootDirectory,
    /** The URI is the root directory of the generated binaries */
    BinariesRootDirectory,
    /** The URI is the root directory of the logical contents */
    TemporaryRootDirectory,
    /** The URI is the root directory of a physical configuration */
    PhysicalConfigurationRootDirectory,
    /** The URI is a standard package directory */
    PackageDirectory,
    /** The URI is a standard package file contents list */
    PackageFileList,
    /** The URI is an IEC program directory */
    IecProgramDirectory,
    /** The URI is an IEC program file contents list */
    IecProgramFileList,
    /** The URI is a C program directory */
    CProgramDirectory,//TODO C++ same? also in all other C values, also check static vs. dynamic Library
    /** The URI is a C program file contents list */
    CProgramFileList,
    /** The URI is a binary library directory */
    BinaryLibraryDirectory,
    /** The URI is a binary library file contents list */
    BinaryLibraryFileList,
    /** The URI is an IEC library directory */
    IecLibraryDirectory,
    /** The URI is an IEC library file contents list */
    IecLibraryFileList,
    /** The URI is a C library directory */
    CLibraryDirectory,
    /** The URI is a C library file contents list */
    CLibraryFileList,
    /** The URI is an IEC source code file */
    IecSourceFile,
    /** The URI is an IEC variables files */
    IecVariablesFile,
    /** The URI is an IEC types file */
    IecTypesFile,
    /** The URI is an IEC function declaration file */
    IecFunctionsFile,
    /** The URI is a C source code file */
    CSourceFile,
    /** The URI is a C header file */
    CHeaderFile
}


//#endregion local types


//#region local functions


/**
 * Searches for AS projects (*.apj files) within all workspace folders and subfolders and collects information about the projects.
 * @param baseUri If set, projects are only searched within this URI.
 */
async function findAsProjectInfo(baseUri?: vscode.Uri): Promise<AsProjectInfo[]> {
    const searchPattern: vscode.GlobPattern = baseUri ? {base: baseUri.fsPath, pattern: '**/*.apj'} : '**/*.apj';
    const projectUris  = await vscode.workspace.findFiles(searchPattern);
    const result: AsProjectInfo[] = [];
    for (const uri of projectUris) {
        // collect data
        const uriData = deriveAsProjectUriData(uri);
        const projectFileData = await BrAsProjectFiles.getProjectFileInfo(uriData.projectFileUri);
        if (!projectFileData) {
            continue;
        }
        const configurationsData = await findAsConfigurationInfo(uriData.physicalUri);
        // push to result
        const projectData: AsProjectInfo = {
            name:                     uriData.projectName,
            description:              projectFileData.description,
            asVersion:                projectFileData.asVersion,
            baseUri:                  uriData.baseUri,
            projectFile:              uriData.projectFileUri,
            logical:                  uriData.logicalUri,
            physical:                 uriData.physicalUri,
            temporary:                uriData.temporaryUri,
            temporaryIncludes:        uriData.temporaryIncludesUri,
            configurations:           configurationsData,
        };
        result.push(projectData);
        };
    return result;
    }


/**
 * Derives information data from an AS project file URI
 * @param projectFileUri URI to the AS project file (*.apj)
 */
function deriveAsProjectUriData(projectFileUri: vscode.Uri) {
    const parsedUri = uriTools.pathParsedUri(projectFileUri);
    return {
        projectName:          parsedUri.name,
        projectFileUri:       projectFileUri,
        baseUri:              parsedUri.dir,
        logicalUri:           uriTools.pathJoin(parsedUri.dir, 'Logical'),
        physicalUri:          uriTools.pathJoin(parsedUri.dir, 'Physical'),
        temporaryUri:         uriTools.pathJoin(parsedUri.dir, 'Temp'),
        temporaryIncludesUri: uriTools.pathJoin(parsedUri.dir, 'Temp/Includes'),
        userSettingsUri:      uriTools.pathJoin(parsedUri.dir, 'LastUser.set')
    };
}


/**
 * Searches for configurations within the physical path of an AS project.
 * @param physicalUri The URI to the physical path of the AS project
 * @returns An array containing the information of all found configurations
 */
async function findAsConfigurationInfo(physicalUri: vscode.Uri): Promise<AsConfigurationInfo[]> {
    const packageUri = uriTools.pathJoin(physicalUri, 'Physical.pkg');
    const physicalInfo = await BrAsProjectFiles.getPhysicalPackageInfo(packageUri);
    if (!physicalInfo) {
        return [];
    }
    return physicalInfo.configurations.map(config => {
        return {
            name:        config.relativePath,
            description: config.description,
            baseUri:     uriTools.pathJoin(physicalUri, config.relativePath)
        };
        });
    }
}


/**
 * Checks if the given URI is within a library (C, IEC and binary) of the AS project.
 * @param asProject The AS project to use
 * @param uri The URI which is checked to be within a library
 * @returns `true` if the uri is within a library directory or any of its subdirectories, `false` otherwise.
 */
async function isInLibrary(asProject: AsProjectInfo, uri: vscode.Uri): Promise<boolean> {
    if (!uriTools.isSubOf(asProject.logical, uri)) {
        return false; // not content of logical
    }
    // get all paths from uri to logical
    const toLogical = uriTools.pathsFromTo(uri, asProject.logical);
    toLogical.pop(); // remove self uri
    toLogical.reverse(); // start from highest level
    // check if one of the paths is a library directory
    for (const actUri of toLogical) {
        const actType = await getProjectUriType(actUri);
        if (actType === ProjectUriType.BinaryLibraryDirectory) {
            return true;
        }
        if (actType === ProjectUriType.IecLibraryDirectory) {
            return true;
        }
        if (actType === ProjectUriType.CLibraryDirectory) {
            return true;
        }
    }
    return false;
}


/**
 * Get header includes for files within a program. No additional checks are done within. Checks need to
 * be done before calling.
 * @param asProject the project to which the code file belongs to
 * @param codeFile the code files for which the header includes are listed. This needs to be an URI to a file.
 */
function getHeaderIncludeDirsForProgram(asProject: AsProjectInfo, codeFile: vscode.Uri): vscode.Uri[] {
    const includeDirs = uriTools.pathsFromTo(asProject.logical, codeFile, asProject.temporaryIncludes);
    includeDirs.pop(); // remove file name
    return includeDirs.reverse(); // highest folder level needs to be searched first on include
}


/**
 * Get header includes for files within a library. No additional checks are done within. Checks need to
 * be done before calling.
 * @param asProject the project to which the code file belongs to
 * @param codeFile the code files for which the header includes are listed. This needs to be an URI to a file.
 */
function getHeaderIncludeDirsForLibrary(asProject: AsProjectInfo, codeFile: vscode.Uri): vscode.Uri[] {
    return [asProject.temporaryIncludes];
}


/**
 * Gets the type of an URI within an AS project context.
 * @param uri The URI to evaluate type
 */
async function getProjectUriType(uri: vscode.Uri) : Promise<ProjectUriType> {
    //TODO review implementation and consider to also change input parameters to  (asProject: AsProjectInfo, uri: vscode.Uri)
    if (await uriTools.isFile(uri)) {
        const info = uriTools.pathParsedUri(uri);
        // project organisation files
        if (info.ext === '.apj') {
            return ProjectUriType.ProjectFile;
        }
        else if (info.ext === '.pkg') {
            //TODO further specify
            return ProjectUriType.PackageFileList;
        }
        else if (info.ext === '.lby') {
            if (info.name.toLowerCase() === 'binary') {
                return ProjectUriType.BinaryLibraryFileList;
            }
            else if (info.name.toLowerCase() === 'iec') {
                return ProjectUriType.IecLibraryFileList;
            }
            else if (info.name.toLowerCase() === 'ansic') {
                return ProjectUriType.CLibraryFileList;
            }
            else {
                return ProjectUriType.Undefined;
            }
        }
        else if (info.ext === '.prg') {
            if (info.name.toLowerCase() === 'iec') {
                return ProjectUriType.IecProgramFileList;
            }
            else if (info.name.toLowerCase() === 'ansic') {
                return ProjectUriType.CProgramFileList;
            }
            else {
                return ProjectUriType.Undefined;
            }
        }
        // IEC files
        else if (info.ext === '.var') {
            return ProjectUriType.IecVariablesFile;
        }
        else if (info.ext === '.typ') {
            return ProjectUriType.IecTypesFile;
        }
        else if (info.ext === '.fun') {
            return ProjectUriType.IecFunctionsFile;
        }
        else if (info.ext === '.st') {
            //TODO other IEC languages
            return ProjectUriType.IecSourceFile;
        }
        // C / C++ files
        else if (info.ext === '.c') {
            // TODO C++ files
            return ProjectUriType.CSourceFile;
        }
        else if (info.ext === '.h') {
            // TODO C++ files
            return ProjectUriType.CHeaderFile;
        }
    } else if (await uriTools.isDirectory(uri)) {
        // get files with types in directory
        const subFiles = await uriTools.listSubFiles(uri);
        const subFilesWithTypes: {uri: vscode.Uri, type: ProjectUriType}[] = [];
        for (const fileUri of subFiles) {
            const type = await getProjectUriType(fileUri);
            subFilesWithTypes.push({
                uri: fileUri,
                type: type
            });
        }
        // check if specific files are present to define a package type
        const hasIecProgramFileList = subFilesWithTypes.find(f => f.type === ProjectUriType.IecProgramFileList) ? true : false;
        if (hasIecProgramFileList) {
            return ProjectUriType.IecProgramDirectory;
        }
        const hasCProgramFileList = subFilesWithTypes.find(f => f.type === ProjectUriType.CProgramFileList) ? true : false;
        if (hasCProgramFileList) {
            return ProjectUriType.CProgramDirectory;
        }
        const hasBinaryLibraryFileList = subFilesWithTypes.find(f => f.type === ProjectUriType.BinaryLibraryFileList) ? true : false;
        if (hasBinaryLibraryFileList) {
            return ProjectUriType.BinaryLibraryDirectory;
        }
        const hasIecLibraryFileList = subFilesWithTypes.find(f => f.type === ProjectUriType.IecLibraryFileList) ? true : false;
        if (hasIecLibraryFileList) {
            return ProjectUriType.IecLibraryDirectory;
        }
        const hasCLibraryFileList = subFilesWithTypes.find(f => f.type === ProjectUriType.CLibraryFileList) ? true : false;
        if (hasCLibraryFileList) {
            return ProjectUriType.CLibraryDirectory;
        }
        const hasPackageFileList = subFilesWithTypes.find(f => f.type === ProjectUriType.PackageFileList) ? true : false;
        if (hasPackageFileList) {
            return ProjectUriType.PackageDirectory;
        }
        const hasProjectFile = subFilesWithTypes.find(f => f.type === ProjectUriType.ProjectFile) ? true : false;
        if (hasProjectFile) {
            return ProjectUriType.ProjectBaseDirectory;
        }
    }
    // no match until now -> undefined
    return ProjectUriType.Undefined;
}


/**
 * NOT YET IMPLEMENTED
 * Get the settings from the LastUser.set file of the AS project.
 * @param asProject The AS project to get the settings for
 */
export async function getUserSettings(asProject: AsProjectInfo) {
    vscode.workspace.textDocuments;
    //TODO implement properly. File parsing of *.set files should be implemented in module BrAsProjectFiles
    //TODO maybe create new interface for settings and add property to interface AsProjectInfo
    //const settingUris = await vscode.workspace.findFiles('*.set');
    const settingUris = await vscode.workspace.findFiles('LastUser.set');
    if (settingUris.length === 0) {
        return undefined;
    }
    const usedSettingUri = settingUris[0]; //TODO get username.set if possible
    const settingDocument = await vscode.workspace.openTextDocument(usedSettingUri);
    const text = settingDocument.getText();
    throw new Error('NOT IMPLEMENTED');
}


//#endregion local functions