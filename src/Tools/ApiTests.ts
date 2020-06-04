import * as vscode from 'vscode';
import * as BRAsProjectWorkspace from '../BRAsProjectWorkspace';

export function registerApiTests(context: vscode.ExtensionContext) {
    let disposable: vscode.Disposable | undefined; // disposable to push for clean up on deactivation
    //#region Commands accessible in UI by using Ctrl+Shift+P
	// Command: Test
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.test',
		(arg1, arg2) => testCommand(arg1, arg2));
    context.subscriptions.push(disposable);
}



async function testCommand(arg1: any, arg2: any) {
	console.log('Selection test started');
	console.log('arg1');
	console.log(arg1);
	console.log('arg2');
	console.log(arg2);
    const selected = await BRAsProjectWorkspace.getUserSettings();
    console.log(`output is ${selected}`);
}