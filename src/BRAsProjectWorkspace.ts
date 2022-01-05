/**
 * Receive information for the AS projects within the workspaces
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import * as BrAsProjectFiles from './BrAsProjectFiles';
import * as uriTools from './Tools/UriTools';
import * as BrCppToolsApi from './BrCppToolsApi'; // HACK to try out change of provider config quick and dirty. Figure out in #5 architectural changes.
import { Logger } from './BrLog';


//#region exported types


/**
 * Information for an AS project
 */
export interface AsProjectInfo extends vscode.Disposable {
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
    /** Absolute URI to the binaries directory */
    binaries: vscode.Uri;
    /** Information for all configurations within this project */
    configurations: AsConfigurationInfo[];
    /** The currently active configuration */
    activeConfiguration?: AsConfigurationInfo;
    //TODO add changed event? Figure out in #5 architectural changes.
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
    /** Absolute URI to the configurations CPU package, which contains most of the files */
    cpuPackageUri: vscode.Uri;
    /** Name of the CPU package */
    cpuPackageName: string;
    /** Build settings of the configuration */
    buildSettings: AsConfigurationBuildSettings;
}


/**
 * Configuration specific build options data
 */
export interface AsConfigurationBuildSettings {
    /** Used gcc version */
    gccVersion?: string | undefined;
    /** Additional build options for all languages */
    additionalBuildOptions: string[];
    /** Additional build options for ANSI C */
    ansiCAdditionalBuildOptions: string[];
    /** Additional build options for IEC languages */
    iecAdditionalBuildOptions: string[];
    /** Include directories for ANSI C */
    ansiCIncludeDirectories: vscode.Uri[];
}


//#endregion exported types


//#region exported functions


/**
 * Activation of AS project workspace
 * @param context context to register disposables
 */
export async function registerProjectWorkspace(context: vscode.ExtensionContext) {
    // register to update on change of workspace folders
    let disposable: vscode.Disposable;
    disposable = vscode.workspace.onDidChangeWorkspaceFolders(() => updateWorkspaceProjects());
    context.subscriptions.push(disposable);
    //TODO also push internal disposables (FileSystemWatcher...)? How? Figure out in #5 architectural changes.
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
    const projectsOld = await _workspaceProjects;
    for (const project of projectsOld) {
        project.dispose();
    }
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
    return projectsSorted.find((p) => uriTools.isSubOf(p.baseUri, uri));
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
    //TODO get additonal includes defined in configuration of programs and libraries (Cpu.sw)
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
    undefined,
    /** The URI is the base directory of an AS project */
    projectBaseDirectory,
    /** The URI is the project file of an AS project */
    projectFile,
    /** The URI is the root directory of the logical contents */
    logicalRootDirectory,
    /** The URI is the root directory of the physical contents */
    physicalRootDirectory,
    /** The URI is the root directory of the generated binaries */
    binariesRootDirectory,
    /** The URI is the root directory of the logical contents */
    temporaryRootDirectory,
    /** The URI is the root directory of a physical configuration */
    physicalConfigurationRootDirectory,
    /** The URI is a standard package directory */
    packageDirectory,
    /** The URI is a standard package file contents list */
    packageFileList,
    /** The URI is an IEC program directory */
    iecProgramDirectory,
    /** The URI is an IEC program file contents list */
    iecProgramFileList,
    /** The URI is a C program directory */
    cProgramDirectory,//TODO C++ same? also in all other C values, also check static vs. dynamic Library
    /** The URI is a C program file contents list */
    cProgramFileList,
    /** The URI is a binary library directory */
    binaryLibraryDirectory,
    /** The URI is a binary library file contents list */
    binaryLibraryFileList,
    /** The URI is an IEC library directory */
    iecLibraryDirectory,
    /** The URI is an IEC library file contents list */
    iecLibraryFileList,
    /** The URI is a C library directory */
    cLibraryDirectory,
    /** The URI is a C library file contents list */
    cLibraryFileList,
    /** The URI is an IEC source code file */
    iecSourceFile,
    /** The URI is an IEC variables files */
    iecVariablesFile,
    /** The URI is an IEC types file */
    iecTypesFile,
    /** The URI is an IEC function declaration file */
    iecFunctionsFile,
    /** The URI is a C source code file */
    cSourceFile,
    /** The URI is a C header file */
    cHeaderFile
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
        const asVersion = projectFileData?.header.asWorkingVersion ?? projectFileData?.header.asVersion;
        if (!projectFileData || !asVersion) {
            Logger.default.error(`Project '${uriData.baseUri.fsPath}' is not supported by the extension`);
            continue;
        }
        const configurationsData = await findAsConfigurationInfo(uriData.physicalUri, uriData.baseUri);
        const activeConfiguration = await getActiveConfiguration(configurationsData, uriData.userSettingsUri);
        // push to result
        const projectData: AsProjectInfo = {
            name:                uriData.projectName,
            description:         projectFileData.description,
            asVersion:           asVersion,
            baseUri:             uriData.baseUri,
            projectFile:         uriData.projectFileUri,
            logical:             uriData.logicalUri,
            physical:            uriData.physicalUri,
            temporary:           uriData.temporaryUri,
            temporaryIncludes:   uriData.temporaryIncludesUri,
            binaries:            uriData.binariesUri,
            configurations:      configurationsData,
            activeConfiguration: activeConfiguration,
            dispose: () => {
                userSettingsWatcher.dispose();
            }
        };
        result.push(projectData);
        // Register file system events for LastUser.set -> change active configuration
        const userSettingsWatcher = vscode.workspace.createFileSystemWatcher(uriTools.uriToSingleFilePattern(uriData.userSettingsUri));
        userSettingsWatcher.onDidChange(async (uri) => {
            projectData.activeConfiguration = await getActiveConfiguration(configurationsData, uri);
            await BrCppToolsApi.didChangeCppToolsConfig(); // HACK to try out change of provider config quick and dirty. Figure out in #5 architectural changes.
        });
        userSettingsWatcher.onDidCreate(async (uri) => {
            projectData.activeConfiguration = await getActiveConfiguration(configurationsData, uri);
            await BrCppToolsApi.didChangeCppToolsConfig(); // HACK to try out change of provider config quick and dirty. Figure out in #5 architectural changes.
        });
        userSettingsWatcher.onDidDelete(async (uri) => {
            projectData.activeConfiguration = await getActiveConfiguration(configurationsData, uri);
            await BrCppToolsApi.didChangeCppToolsConfig(); // HACK to try out change of provider config quick and dirty. Figure out in #5 architectural changes.
        });
    };
    await BrCppToolsApi.didChangeCppToolsConfig(); // HACK to try out change of provider config quick and dirty. Figure out in #5 architectural changes.
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
        binariesUri:          uriTools.pathJoin(parsedUri.dir, 'Binaries'),
        userSettingsUri:      uriTools.pathJoin(parsedUri.dir, 'LastUser.set')
    };
}


/**
 * Searches for configurations within the physical path of an AS project.
 * @param physicalUri The URI to the physical path of the AS project
 * @param projectBaseUri The URI to the AS project root directory
 * @returns An array containing the information of all found configurations
 */
async function findAsConfigurationInfo(physicalUri: vscode.Uri, projectRootUri: vscode.Uri): Promise<AsConfigurationInfo[]> {
    const result: AsConfigurationInfo[] = [];
    // get available configurations from Physical.pkg
    const packageUri = uriTools.pathJoin(physicalUri, 'Physical.pkg');
    const physicalInfo = await BrAsProjectFiles.getPhysicalPackageInfo(packageUri);
    if (!physicalInfo) {
        return [];
    }
    // get detail information of all found configurations
    for (const config of physicalInfo.configurations) {
        const configBaseUri = uriTools.pathJoin(physicalUri, config.relativePath);
        // get data from Config.pkg
        const configPkgUri  = uriTools.pathJoin(configBaseUri, 'Config.pkg');
        const configPkgInfo = await BrAsProjectFiles.getConfigPackageInfo(configPkgUri);
        if (!configPkgInfo) {
            Logger.default.warning(`No configuration data found in ${configPkgUri.fsPath}. Configuration will be skipped!`);
            continue;
        }
        const cpuPkgDirUri = uriTools.pathJoin(configBaseUri, configPkgInfo.cpuPackageName);
        // get data from Cpu.pkg
        const cpuPkgUri  = uriTools.pathJoin(cpuPkgDirUri, 'Cpu.pkg');
        const cpuPkgInfo = await BrAsProjectFiles.getCpuPackageInfo(cpuPkgUri);
        const ansiCIncludeDirs = cpuPkgInfo?.build.ansiCIncludeDirectories?.map((path) => uriTools.pathResolve(projectRootUri, path));
        // push to result
        const configData: AsConfigurationInfo = {
            name:           config.relativePath,
            description:    config.description,
            baseUri:        configBaseUri,
            cpuPackageUri:  cpuPkgDirUri,
            cpuPackageName: configPkgInfo.cpuPackageName,
            buildSettings: {
                gccVersion:                  cpuPkgInfo?.build?.gccVersion,
                additionalBuildOptions:      cpuPkgInfo?.build.additionalBuildOptions ?? [],
                ansiCAdditionalBuildOptions: cpuPkgInfo?.build.ansiCAdditionalBuildOptions ?? [],
                iecAdditionalBuildOptions:   cpuPkgInfo?.build.iecAdditionalBuildOptions ?? [],
                ansiCIncludeDirectories:     ansiCIncludeDirs ?? []
            }
        };
        result.push(configData);
    }
    return result;
}


async function getActiveConfiguration(configurations: AsConfigurationInfo[], userSettingsUri: vscode.Uri): Promise<AsConfigurationInfo | undefined> {
    if (configurations.length === 0) {
        Logger.default.debug('getActiveConfiguration() -> configurations.length === 0', {data: userSettingsUri});
        return undefined;
    }
    const userSettingsData = await BrAsProjectFiles.getUserSettingsInfo(userSettingsUri);
    let activeConfiguration = configurations.find((config) => config.name === userSettingsData?.activeConfiguration);
    if (!activeConfiguration) {
        activeConfiguration = configurations[0];
        Logger.default.warning(`LastUser.set file was not found or is invalid. '${activeConfiguration.name}' will be used as active configuration`);
    }
    return activeConfiguration;
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
        if (actType === ProjectUriType.binaryLibraryDirectory) {
            return true;
        }
        if (actType === ProjectUriType.iecLibraryDirectory) {
            return true;
        }
        if (actType === ProjectUriType.cLibraryDirectory) {
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
    const configIncludeDirs = asProject.activeConfiguration?.buildSettings.ansiCIncludeDirectories ?? [];
    const iecIncludeDirs = uriTools.pathsFromTo(asProject.logical, codeFile, asProject.temporaryIncludes);
    iecIncludeDirs.pop(); // remove file name
    iecIncludeDirs.reverse(); // highest folder level needs to be searched first on include
    return [...configIncludeDirs, ...iecIncludeDirs];
}


/**
 * Get header includes for files within a library. No additional checks are done within. Checks need to
 * be done before calling.
 * @param asProject the project to which the code file belongs to
 * @param codeFile the code files for which the header includes are listed. This needs to be an URI to a file.
 */
function getHeaderIncludeDirsForLibrary(asProject: AsProjectInfo, codeFile: vscode.Uri): vscode.Uri[] {
    const configIncludeDirs = asProject.activeConfiguration?.buildSettings.ansiCIncludeDirectories ?? [];
    return [asProject.temporaryIncludes, ...configIncludeDirs];
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
            return ProjectUriType.projectFile;
        }
        else if (info.ext === '.pkg') {
            //TODO further specify
            return ProjectUriType.packageFileList;
        }
        else if (info.ext === '.lby') {
            if (info.name.toLowerCase() === 'binary') {
                return ProjectUriType.binaryLibraryFileList;
            }
            else if (info.name.toLowerCase() === 'iec') {
                return ProjectUriType.iecLibraryFileList;
            }
            else if (info.name.toLowerCase() === 'ansic') {
                return ProjectUriType.cLibraryFileList;
            }
            else {
                return ProjectUriType.undefined;
            }
        }
        else if (info.ext === '.prg') {
            if (info.name.toLowerCase() === 'iec') {
                return ProjectUriType.iecProgramFileList;
            }
            else if (info.name.toLowerCase() === 'ansic') {
                return ProjectUriType.cProgramFileList;
            }
            else {
                return ProjectUriType.undefined;
            }
        }
        // IEC files
        else if (info.ext === '.var') {
            return ProjectUriType.iecVariablesFile;
        }
        else if (info.ext === '.typ') {
            return ProjectUriType.iecTypesFile;
        }
        else if (info.ext === '.fun') {
            return ProjectUriType.iecFunctionsFile;
        }
        else if (info.ext === '.st') {
            //TODO other IEC languages
            return ProjectUriType.iecSourceFile;
        }
        // C / C++ files
        else if (info.ext === '.c') {
            // TODO C++ files
            return ProjectUriType.cSourceFile;
        }
        else if (info.ext === '.h') {
            // TODO C++ files
            return ProjectUriType.cHeaderFile;
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
        const hasIecProgramFileList = subFilesWithTypes.find((f) => f.type === ProjectUriType.iecProgramFileList) ? true : false;
        if (hasIecProgramFileList) {
            return ProjectUriType.iecProgramDirectory;
        }
        const hasCProgramFileList = subFilesWithTypes.find((f) => f.type === ProjectUriType.cProgramFileList) ? true : false;
        if (hasCProgramFileList) {
            return ProjectUriType.cProgramDirectory;
        }
        const hasBinaryLibraryFileList = subFilesWithTypes.find((f) => f.type === ProjectUriType.binaryLibraryFileList) ? true : false;
        if (hasBinaryLibraryFileList) {
            return ProjectUriType.binaryLibraryDirectory;
        }
        const hasIecLibraryFileList = subFilesWithTypes.find((f) => f.type === ProjectUriType.iecLibraryFileList) ? true : false;
        if (hasIecLibraryFileList) {
            return ProjectUriType.iecLibraryDirectory;
        }
        const hasCLibraryFileList = subFilesWithTypes.find((f) => f.type === ProjectUriType.cLibraryFileList) ? true : false;
        if (hasCLibraryFileList) {
            return ProjectUriType.cLibraryDirectory;
        }
        const hasPackageFileList = subFilesWithTypes.find((f) => f.type === ProjectUriType.packageFileList) ? true : false;
        if (hasPackageFileList) {
            return ProjectUriType.packageDirectory;
        }
        const hasProjectFile = subFilesWithTypes.find((f) => f.type === ProjectUriType.projectFile) ? true : false;
        if (hasProjectFile) {
            return ProjectUriType.projectBaseDirectory;
        }
    }
    // no match until now -> undefined
    return ProjectUriType.undefined;
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