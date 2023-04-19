/**
 * Tools for URI handling
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import { posix } from 'path'; // always use posix style path for vscode.Uri.path: https://github.com/microsoft/vscode-extension-samples/blob/master/fsconsumer-sample/README.md
import { testStringFilter } from './Helpers';

//#region implementations of path.posix for vscode.Uri
// see also https://nodejs.org/docs/latest/api/path.html

/**
 * Return the last portion of a path. Similar to the Unix basename command.
 * Often used to extract the file name from a fully qualified path.
 *
 * @param p the path to evaluate.
 * @param ext optionally, an extension to remove from the result.
 */
export function pathBasename(uri: vscode.Uri, extension?: string): string {
    return posix.basename(uri.path, extension);
}


/**
 * Return the directory name of a path. Similar to the Unix dirname command.
 * @param uri the path to evaluate.
 */
export function pathDirname(uri: vscode.Uri): vscode.Uri {
    const dirPath = posix.dirname(uri.path);
    return uri.with({path: dirPath});
}


/**
 * Uses path.posix.join to derive a new URI with a joined path
 * @param baseUri URI base
 * @param append paths to append
 */
export function pathJoin(baseUri: vscode.Uri, ...append: string[]): vscode.Uri {
    //TODO obsolete? -> vscode.Uri.joinPath
    //TODO no! go back to uriTools.pathJoin for uniform code structure. vscode api still lacks others, e.g. relative, resolve...
    //     behaviour is same as vscode api
    const basePath = baseUri.path;
    const joinedPath = posix.join(basePath, ...append);
    const joinedUri = baseUri.with({path: joinedPath});
    return joinedUri;
}


export function pathRelative(from: vscode.Uri, to: vscode.Uri): string {
    // workaround to normalize file paths on windows (c:/ and C:/ get only normalized on uri.fspath, but not on vscode.Uri.file())
    const usedFrom = (from.scheme !== 'file') ? from : vscode.Uri.file(from.fsPath);
    const usedTo   = (to.scheme !== 'file')   ? to   : vscode.Uri.file(to.fsPath);
    return posix.relative(usedFrom.path, usedTo.path);
}


/**
 * Uses path.posix.resolve to derive a new URI with a resolved path
 * @param baseUri URI base
 * @param append paths to resolve
 */
export function pathResolve(baseUri: vscode.Uri, ...resolve: string[]): vscode.Uri {
    const basePath = baseUri.path;
    const resolvedPath = posix.resolve(basePath, ...resolve);
    const resolvedUri = baseUri.with({path: resolvedPath});
    return resolvedUri;
}


/**
 * Returns an array of URIs which represent all relatives from one uri to another URI.
 * from and to are included in the result. If from and to are same, it results in only one
 * array member.
 * @param replaceFrom If set, the URI of from is replaced with this value in the result.
 */
export function pathsFromTo(from: vscode.Uri, to: vscode.Uri, replaceFrom?: vscode.Uri): vscode.Uri[] {
    // split relative path to single path entries
    const splitRelatives = pathRelative(from, to).split('/');
    // create all URIs relative to Temp/Includes
    const paths = [replaceFrom?.with({}) ?? from.with({})];
    let currentUri = paths[0];
    for (const actSplit of splitRelatives) {
        if (actSplit.length === 0) {
            continue; // skip empty segments -> if from and to are same, the URI is only entered once
        }
        currentUri = pathJoin(currentUri, actSplit);
        paths.push(currentUri);
    }
    return paths;
}

/**
 * Returns a parsed object for the URI, similar to path.parse.
 * @param uri The URI which is parsed
 */
export function pathParsedUri(uri: vscode.Uri): ParsedPathUri {
    const parsedPath = posix.parse(uri.path);
    return {
        root: uri.with({path: parsedPath.root}),
        dir: uri.with({path: parsedPath.dir}),
        base: parsedPath.base,
        ext: parsedPath.ext,//TODO maybe set undefined when empty?
        name: parsedPath.name
    };
}


/**
 * A parsed URI path object.
 */
export interface ParsedPathUri {
    /** The root of the path such as '/' or 'c:\' */
    //TODO does it work with file://c:/...
    root: vscode.Uri;

    /** The full directory */
    dir: vscode.Uri;

    /** The file name including extension (if any) such as 'index.html' */
    base: string;

    /** The file extension (if any) such as '.html' */
    ext: string;

    /** The file name without extension (if any) such as 'index' */
    name: string;
}

/**
 * Converts a windows style path to a posix style path in the following manner:
 * 
 * Absolute drive letter paths: `C:\Temp\Test.txt` → `/C:/Temp/Test.txt`
 * 
 * UNC paths: `\\Server\Share\Temp\Test.txt` → `/Server/Share/Temp/Test.txt`
 * 
 * Relative paths: `Temp\Test.txt` → `./Temp/Test.txt` and `..\Temp\Test.txt` → `./../Temp/Test.txt`
 * 
 * Absolute to current drive: `\Temp\Test.txt` → `./Temp/Test.txt`
 * Such paths are used in Automation Studio projects as relative to the project root. These paths
 * are interpreted relative, so they can be resolved properly when the context is known.
 * 
 * see also https://docs.microsoft.com/en-us/dotnet/standard/io/file-path-formats
 * @param winPath Windows style path as e.g. found in AS project package files
 * @returns Posix style relative or absolute path which can be used in `pathJoin()` or `pathResolve()`
 */
export function winPathToPosixPath(winPath: string): string {
    // replace all \ first, so later checks can directly return result
    const preparedPath = winPath.split('\\').join('/');
    // Absolute drive letter path
    const driveLetterRegExp = /^([a-zA-Z]:)\//;
    const driveLetterSubst = '/$1/';
    if (driveLetterRegExp.test(preparedPath)) {
        return preparedPath.replace(driveLetterRegExp, driveLetterSubst);
    }
    // UNC paths
    if (preparedPath.startsWith('//')) {
        return preparedPath.substring(1);
    }
    // Absolute to current drive → handled as relative
    if (preparedPath.startsWith('/')) {
        return `.${preparedPath}`;
    }
    // all remaining ones are already relative
    return preparedPath;
}

//#endregion implementations of path.posix for vscode.Uri


/**
 * Checks if an URI is a sub URI of a base URI
 * @example ```isSubOf(file:///C:/Temp, file:///C:/Temp/Test/Test1.txt) === true```
 * @example ```isSubOf(file:///C:/Temp, file:///C:/User/Test/Test1.txt) === false```
 * @param base Base for checking of sub
 * @param uri URI which is checked to be a sub of base
 */
export function isSubOf(base: vscode.Uri, uri: vscode.Uri): boolean {
    if (base.scheme !== uri.scheme) {
        return false;
    }
    if (base.authority !== uri.authority) {
        return false;
    }
    const relative = pathRelative(base, uri);
    if (relative.startsWith('..')) {
        return false;
    } else {
        return true;
    }
}


/**
 * Checks if an URI exists
 * @param uri URI which is checked
 */
export async function exists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}


/**
 * Checks if a URI points to a file
 * @param uri URI which is checked
 */
export async function isFile(uri: vscode.Uri): Promise<boolean> {
    try {
        const info = await vscode.workspace.fs.stat(uri);
        return info.type === vscode.FileType.File;
    } catch {
        return false;
    }
}


/**
 * Checks if a URI points to a directory
 * @param uri URI which is checked
 */
export async function isDirectory(uri: vscode.Uri): Promise<boolean> {
    try {
        const info = await vscode.workspace.fs.stat(uri);
        return info.type === vscode.FileType.Directory;
    } catch {
        return false;
    }
}


/**
 * Lists the names of all subdirectories within a base URI.
 * @param baseUri The base for the list
 * @param filter An optional filter for the directory name.
 */
export async function listSubDirectoryNames(baseUri: vscode.Uri, filter?: string | RegExp): Promise<string[]> {
    return await listSubsOfType(baseUri, vscode.FileType.Directory, filter);
}


/**
 * Lists the full URIs of all subdirectories within a base URI.
 * @param baseUri The base for the list.
 * @param filter An optional filter for the directory name.
 */
export async function listSubDirectories(baseUri: vscode.Uri, filter?: string | RegExp): Promise<vscode.Uri[]> {
    const dirNames = await listSubDirectoryNames(baseUri, filter);
    return dirNames.map((name) => pathJoin(baseUri, name));
}


/**
 * Lists the names of all the files within a base URI.
 * @param baseUri The base for the list.
 * @param filter An optional filter for the file name.
 */
export async function listSubFileNames(baseUri: vscode.Uri, filter?: string | RegExp): Promise<string[]> {
    return await listSubsOfType(baseUri, vscode.FileType.File, filter);
}


/**
 * Lists the full URIs of all the files within a base URI.
 * @param baseUri The base for the list.
 * @param filter An optional filter for the file name.
 */
export async function listSubFiles(baseUri: vscode.Uri, filter?: string | RegExp): Promise<vscode.Uri[]> {
    const fileNames = await listSubFileNames(baseUri, filter);
    return fileNames.map((name) => pathJoin(baseUri, name));
}

/**
 * Lists the full URIs of all subdirectories within multiple base URIs as a flat array.
 * This can be helpful e.g. for a breadth first tree search
 * @param baseUris The base URIs for the list.
 * @returns A flat array containing the URIs to the sub directories of all base URIs
 */
async function listAllSubDirectories(...baseUris: vscode.Uri[]): Promise<vscode.Uri[]> {
    const result: vscode.Uri[] = [];
    for (const uri of baseUris) {
        const subs = await listSubDirectories(uri);
        result.push(...subs);
    }
    return result;
}


/**
 * Lists the names of all sub filesystem objects of a specified type within a base URI.
 * @param baseUri The base URI to search in.
 * @param fileType The file type to search for.
 * @param filter An optional filter for the sub element name.
 */
async function listSubsOfType(baseUri: vscode.Uri, fileType: vscode.FileType, filter?: string | RegExp): Promise<string[]> {
    const subs = await vscode.workspace.fs.readDirectory(baseUri);
    const subsOfType = subs.filter((sub) => sub[1] === fileType);
    const subNames = subsOfType.map((sub) => sub[0]);
    return subNames.filter((name) => testStringFilter(name, filter));
}

/**
 * Creates a `vscode.RelativePattern` which matches only the specified file URI.
 * @param uri URI to create the pattern from
 */
export function uriToSingleFilePattern(uri: vscode.Uri): vscode.RelativePattern {
    const fileName = pathBasename(uri);
    const dirPath = pathDirname(uri);
    return new vscode.RelativePattern(dirPath, fileName);
}

/**
 * Recursive search for a directory. A breadth first search is used and the first match will be returned.
 * This function can have better performance than `vscode.workspace.findFiles()` in some cases.
 * @param rootUri The starting point for the search
 * @param filter The used filter for the search. Use string for an exact match, or a RegExp for a pattern match
 * @param depth The maximum level of subdirectories in which is searched. Depth 0 means only direct children of `rootUri` will be searched.
 * @returns The first found directory which matches the criteria, or undefined if no such was found
 */
export async function findDirectory(rootUri: vscode.Uri, depth: number, filter: string | RegExp): Promise<vscode.Uri | undefined> {
    // prepare result and current search level
    let result: vscode.Uri | undefined = undefined;
    let actDepthUris: vscode.Uri[] = [rootUri];
    // search loop
    for (let actDepth = 0; actDepth <= depth; actDepth++) {
        // get all subdirectories of the current depth
        const subDirs = await listAllSubDirectories(...actDepthUris);
        // find match
        const match = subDirs.find((dir) => testStringFilter(pathBasename(dir), filter));
        // finish on first match
        if (match !== undefined) {
            result = match;
            break;
        }
        // set new starting point for next iteration
        actDepthUris = subDirs;
    }
    return result;
}