import * as vscode from 'vscode';
import {posix, ParsedPath} from 'path'; // always use posix style path for vscode.Uri.path: https://github.com/microsoft/vscode-extension-samples/blob/master/fsconsumer-sample/README.md

//#region implementations of path.posix for vscode.Uri

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
 * Uses path.posix.join to derive a new URI with a joined path
 * @param baseUri URI base
 * @param append paths to append
 */
export function pathJoin(baseUri: vscode.Uri, ...append: string[]): vscode.Uri {
    const basePath = baseUri.path;
    const joinedPath = posix.join(basePath, ...append);
    const joinedUri = baseUri.with({path: joinedPath});
    return joinedUri;
}

export function pathRelative(from: vscode.Uri, to: vscode.Uri): string {
    return posix.relative(from.path, to.path);
}

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
//#endregion implementations of path.posix for vscode.Uri

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

export async function isFile(uri: vscode.Uri): Promise<boolean> {
    try {
        const info = await vscode.workspace.fs.stat(uri);
        return info.type === vscode.FileType.File;
    } catch {
        return false;
    }
}

export async function isDirectory(uri: vscode.Uri): Promise<boolean> {
    try {
        const info = await vscode.workspace.fs.stat(uri);
        return info.type === vscode.FileType.Directory;
    } catch {
        return false;
    }
}

async function listSubsOfType(baseUri: vscode.Uri, fileType: vscode.FileType): Promise<string[]> {
    const subs = await vscode.workspace.fs.readDirectory(baseUri);
    const subsOfType = subs.filter(sub => sub[1] === fileType);
    const subNames = subsOfType.map(sub => sub[0]);
    return subNames;
}

/**
 * Lists the names of all subdirectories of a base.
 * @param baseUri The base for the list
 */
export async function listSubDirectoryNames(baseUri: vscode.Uri) {
    return await listSubsOfType(baseUri, vscode.FileType.Directory);
}