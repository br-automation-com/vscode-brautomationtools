/**
 * Tools for file creation and modification
 * @packageDocumentation
 */

import * as vscode from 'vscode';


/**
 * Creates a file at a given URI
 * @param uri The URI of the file to be created
 * @param options Options for the file creation
 * @return A thenable that resolves when the creation could be applied
 */
export async function createFile(uri: vscode.Uri, options?: { overwrite?: boolean, ignoreIfExists?: boolean }): Promise<boolean> {
    const wsedit = new vscode.WorkspaceEdit();
    wsedit.createFile(uri, options);
    return vscode.workspace.applyEdit(wsedit);
}


/**
 * Inserts a given text at a given position in a file. File is automatically saved and therefore the editor will not be opened.
 * @param uri The URI of the file which will be modified
 * @param position The position in the file where the text will be inserted
 * @param newText The text which will be inserted
 */
export async function insertTextInFile(uri: vscode.Uri, position: vscode.Position, newText: string): Promise<boolean> {
    
	const doc = await vscode.workspace.openTextDocument(uri);
	const wsedit = new vscode.WorkspaceEdit();
	wsedit.insert(uri, position, newText);
	await vscode.workspace.applyEdit(wsedit);
	return doc.save();
}


/**
 * Inserts a given text at the begin of a file. File is automatically saved and therefore the editor will not be opened.
 * @param uri The URI of the file which will be modified
 * @param newText The text which will be inserted
 */
export async function insertTextAtBeginOfFile(uri: vscode.Uri, newText: string): Promise<boolean> {
    return insertTextInFile(uri, new vscode.Position(0, 0), newText);
}
