import * as vscode from 'vscode';
import * as uriTools from './Tools/UriTools';


//#region interfaces
export interface AsProjectInfo {
    baseUri: vscode.Uri,
    projectFile: vscode.Uri,
    asVersion: string;
    logical: vscode.Uri,
    physical: vscode.Uri,
    temporary: vscode.Uri,
    temporaryIncludes: vscode.Uri
    configurations: AsConfigurationInfo[];
    description?: string; //TODO implement here and in dialogs
    name?: string; //TODO implement as mandatory here and in dialogs
}

export interface AsConfigurationInfo {
    baseUri: vscode.Uri;
    name: string;
    description?: string;
}

//#region project directories parsing
/** Describes the context of an URI within AS project diractory and file types */
export interface ProjectUriWithType { //TODO there are two difficulties in programming: 1. cache invalidation, 2. naming things, 3. of by one errors
    uri: vscode.Uri;
    type: ProjectUriType;
}

/** The type of an URI object within the Automation Studio context */
export enum ProjectUriType {
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
//#endregion interfaces

//#region exported functions
/**
 * Activation of AS project workspace
 * @param context context to register disposables
 */
export async function registerProjectWorkspace(context: vscode.ExtensionContext) {
    let disposable: vscode.Disposable;
    updateWorkspaceProjects();
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
 */
export async function updateWorkspaceProjects(): Promise<Number> {
    _workspaceProjects = findAsProjectInfo();
    return (await _workspaceProjects).length;
}
/**
 * Gets to which the given URI belongs. The URI belongs to an AS project if it is a subpath of the
 * AS project URI.
 * @param uri URI which is checked to be within a project
 * @returns `undefined` if no AS project was found.
 */
export async function getProjectForUri(uri: vscode.Uri): Promise<AsProjectInfo | undefined> {
    // get projects
    const projects = await getWorkspaceProjects();
    // sort projects so the longest path is first -> when an AS project is within an AS project the proper one is found
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

//TODO use in C/C++ provider
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
let _workspaceProjects: Promise<AsProjectInfo[]> = findAsProjectInfo();
//#endregion local variables

//#region workspace directories parsing
async function findAsProjectInfo(baseUri?: vscode.Uri): Promise<AsProjectInfo[]> {
    const searchPattern: vscode.GlobPattern = baseUri ? {base: baseUri.fsPath, pattern: '**/*.apj'} : '**/*.apj';
    const projectUris  = await vscode.workspace.findFiles(searchPattern);
    const projectUrisParsed = projectUris.map(uri => uriTools.pathParsedUri(uri));
    const projectsData: AsProjectInfo[] = [];
    for (const parsed of projectUrisParsed) {
        const data: AsProjectInfo = {
            baseUri:           parsed.dir,
            projectFile:       uriTools.pathJoin(parsed.dir, parsed.base),
            asVersion:         'V4.6.5.78 SP',//TODO
            logical:           uriTools.pathJoin(parsed.dir, 'Logical'),
            physical:          uriTools.pathJoin(parsed.dir, 'Physical'),
            temporary:         uriTools.pathJoin(parsed.dir, 'Temp'),
            temporaryIncludes: uriTools.pathJoin(parsed.dir, 'Temp/Includes'),
            configurations:    []
        };
        await findAsConfigurationInfo(data);
        projectsData.push(data);
    }
    return projectsData;
}

/**
 * Searches for configurations within asProject.physical and pushes all found versions to asProject.configurations
 * @param asProject AS project info for which configurations are searched. asVersion.configurations is modified by this function
 */
async function findAsConfigurationInfo(asProject: AsProjectInfo): Promise<void> {
    const configDirNames = await uriTools.listSubDirectoryNames(asProject.physical);
    for (const dirName of configDirNames) {
        const dirUri = uriTools.pathJoin(asProject.physical, dirName);
        const configInfo: AsConfigurationInfo = {
            name: dirName,
            baseUri: dirUri,
            description: undefined //TODO implement getting of configuration description
        };
        asProject.configurations.push(configInfo);
    }
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
 * Get header includes for files within a library. No additional checks are done within. Checks need to
 * be done before calling.
 * @param asProject the project to which the code file belongs to
 * @param codeFile the code files for which the header includes are listed. This needs to be an URI to a file.
 */
function getHeaderIncludeDirsForLibrary(asProject: AsProjectInfo, codeFile: vscode.Uri): vscode.Uri[] {
    return [asProject.temporaryIncludes];
}

export async function getProjectUriType(uri: vscode.Uri) : Promise<ProjectUriType> {
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

    //TODO
    return ProjectUriType.Undefined;
}

export async function getUserSettings() {
    vscode.workspace.textDocuments;
    //const settingUris = await vscode.workspace.findFiles('*.set');
    const settingUris = await vscode.workspace.findFiles('LastUser.set');
    if (settingUris.length === 0) {
        return undefined;
    }
    const usedSettingUri = settingUris[0]; //TODO get username.set if possible
    const settingDocument = await vscode.workspace.openTextDocument(usedSettingUri);
    const text = settingDocument.getText();
    //TODO XML parsing

    return text;
}