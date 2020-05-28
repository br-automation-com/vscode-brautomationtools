import * as vscode from 'vscode';

export namespace Helpers {
    /**
     * Lists all files / directories of a specified type within a directory
     * @param directoryUri URI of base directory
     * @param fileType File type which should be listed
     */
	export async function listFilesOfType(directoryUri: vscode.Uri, fileType: vscode.FileType) {
		return (await vscode.workspace.fs.readDirectory(directoryUri))
			.filter(f => f[1] === fileType)
			.map(d => d[0]);
    }
    
    export async function listDirectories(directoryUri: vscode.Uri)
    {
        return listFilesOfType(directoryUri, vscode.FileType.Directory);
    }

    export function appendUri(baseUri:vscode.Uri, append:string, autoInsertSeparator:boolean = false, separatorString:string = '/') {
        const base = baseUri.toString();
        let usedSeparator = '';
        if (autoInsertSeparator) {
            const hasSeparator = base.endsWith(separatorString) || append.startsWith(separatorString);
            if (!hasSeparator) {
                usedSeparator = separatorString;
            }
        }
        return vscode.Uri.parse(base + usedSeparator + append);
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

    export function logTimedHeader(message: string, lineLength: number = 150): void {
        const time = new Date().toLocaleTimeString();
        const separator = ' - ';
        const messageWithTime = time + separator + message + ' ';
        const fillLength = lineLength - messageWithTime.length;
        const fill = (fillLength > 0) ? '*'.repeat(fillLength) : '';
        console.log(messageWithTime + fill);
    }
}
