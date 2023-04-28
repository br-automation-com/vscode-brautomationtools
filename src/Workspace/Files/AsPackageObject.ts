import { Uri } from "vscode";
import { logger } from "../../Tools/Logger";
import { listSubFiles, pathBasename } from "../../Tools/UriTools";
import { AsPackageFile } from "./AsPackageFile";

/** Data of an object within a package */
export interface AsPackageObject {
    /** Path of the object. Interpretation of the path depends on the value of `isReference` */
    readonly path: string;
    /** Type of the object. e.g. 'Configuration', 'Program', 'File' */
    readonly type?: string | undefined;
    /** Language of the object, mostly used in library or program objects. e.g. 'IEC' or 'ANSIC' */
    readonly language?: string | undefined;
    /** Additional description of the object for documentation */
    readonly description?: string | undefined;
    /** The object is referenced (SymLink).
     *
     * If `false` or `undefined`, path is relative to the directory containing the package file. Use `pathJoin(packageDir, path)` to get the full path.
     *
     * If `true`, the path will be either relative to the project root or absolute. Use `pathResolve(projectRoot, path)` to get the full path.
     */
    readonly isReference?: boolean | undefined;
    /** Used for type and variable declaration files, to define if the declarations are global or limited to package scope. */
    readonly isPrivate?: boolean | undefined;
    /** Resolve `path` to get absolute URIs */
    readonly resolvePath: (projectRoot: Uri) => Uri;
}

/**
 * Creates an AsPackageObject representation parsed from a directory
 * @param dirPath Path to a directory for which a package object will be created
 * @param relativeTo TODO
 * @returns A package object for the specified path, or `undefined` if the operation failed
 */
export async function packageObjectFromDirPath(dirPath: Uri, relativeTo?: Uri): Promise<AsPackageObject | undefined> {
    // find package files within directory
    const subFiles = await listSubFiles(dirPath);
    const dirPackageFiles = subFiles.filter((filePath) => AsPackageFile.isPackageFileName(filePath));
    // use package file if one result was found
    if (dirPackageFiles.length === 1) {
        return await packageObjectFromPackageFilePath(dirPackageFiles[0], relativeTo);
    } else if (dirPackageFiles.length > 1) {
        logger.warning(`Multiple potential package files found in directory ${logger.formatUri(dirPath)}`);
        return undefined;
    } else {
        logger.warning(`No package file found in directory ${logger.formatUri(dirPath)}`);
        return undefined;
    }
}

/**
 * Creates an AsPackageObject representation parsed from a file path
 * @param filePath Path to a file for which a package object will be created
 * @param relativeTo TODO
 * @returns A package object for the specified path, or `undefined` if the operation failed
 */
export async function packageObjectFromFilePath(filePath: Uri, relativeTo?: Uri): Promise<AsPackageObject | undefined> {
    // TODO use argument 'relativeTo' to make refrenced package object, or introduce other arguments
    // Return package object if it is a package file
    if (AsPackageFile.isPackageFileName(filePath)) {
        return await packageObjectFromPackageFilePath(filePath);
    }
    // normal file if it is no package
    const fileName = pathBasename(filePath);
    return {
        path: fileName,
        type: "File",
        language: undefined,
        description: undefined,
        isReference: undefined,
        isPrivate: undefined,
        resolvePath: () => filePath,
    };
}

async function packageObjectFromPackageFilePath(filePath: Uri, relativeTo?: Uri): Promise<AsPackageObject | undefined> {
    const packageFile = await AsPackageFile.createFromFile(filePath);
    if (packageFile === undefined) return undefined;
    const path = pathBasename(packageFile.dirPath); //TODO handled differently when added as reference
    const pkgType = packageFile.type;
    const language = pkgType === "Program" || pkgType === "Library" || pkgType === "DataObject" ? packageFile.subType : undefined;
    return {
        path: path,
        type: packageFile.type,
        language: language,
        description: undefined, // maybe setting for default description (e.g. TODO add description)
        isReference: undefined,
        isPrivate: undefined,
        resolvePath: () => filePath,
    };
}
