import * as vscode from 'vscode';


/**
 * Lists all files / directories of a specified type within a directory
 * @param directoryUri URI of base directory
 * @param fileType File type which should be listed
 */
async function listFilesOfType(directoryUri: vscode.Uri, fileType: vscode.FileType) {
    return (await vscode.workspace.fs.readDirectory(directoryUri))
        .filter(f => f[1] === fileType)
        .map(d => d[0]);
}

export function getRelativeUri(baseUri: vscode.Uri, fullUri: vscode.Uri): string | undefined {
    const base = baseUri.toString();
    const full = fullUri.toString();
    const basePosInFull = full.indexOf(base);
    if (basePosInFull === 0) {
        const relative = full.substr(base.length);
        return relative;
    }
    else {
        return undefined;
    }
    //TODO test
}

export async function uriExists(uri: vscode.Uri)
{
    //TODO test
    const a = await vscode.workspace.fs.stat(uri);
    const b = a.type !== vscode.FileType.Unknown;
}

export function logTimedHeader(message: string, lineLength: number = 150): void {
    const time = new Date().toLocaleTimeString();
    const separator = ' - ';
    const messageWithTime = time + separator + message + ' ';
    const fillLength = lineLength - messageWithTime.length;
    const fill = (fillLength > 0) ? '*'.repeat(fillLength) : '';
    console.warn(messageWithTime + fill);
}

/**
 * Pushes an item to an array, only if the item is not null or undefined
 * @param array Array to which item is pushed
 * @param item Item which is checked and pushed
 */
export function pushDefined<T>(array: T[], item: T | undefined | null) {
    if (item ?? false) { //TODO test with booleans
        array.push(item!);
    }
}
