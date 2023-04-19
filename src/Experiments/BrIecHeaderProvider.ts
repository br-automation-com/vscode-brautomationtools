/**
 * Provide headers for IEC files as virtual documents. Not yet implemented!
 * @packageDocumentation
 */

import * as vscode from "vscode";

export async function testProvideHeader(context: vscode.ExtensionContext): Promise<void> {
    //TODO providing a text document works fine, but how to make it accessible for C/C++ extension?
    const myProvider = new (class implements vscode.TextDocumentContentProvider {
        // emitter and its event
        onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
        onDidChange = this.onDidChangeEmitter.event;

        provideTextDocumentContent(uri: vscode.Uri): string {
            const header = `
                // ${uri.path}
                /* Automation Studio generated header file */
                /* Do not edit ! */

                #ifndef _BUR_1588951000_6_
                #define _BUR_1588951000_6_

                #include <bur/plctypes.h>

                /* Constants */
                #ifdef _REPLACE_CONST
                #else
                #endif


                /* Variables */
                _BUR_LOCAL struct MyStructType MyStruct;
                _BUR_LOCAL unsigned char Counter;





                __asm__(".section ".plc"");

                /* Used IEC files */
                __asm__(".ascii "iecfile \\"Logical/NoErrNoWrn/CPrgMulti/Variables.var\\" scope \\"local\\"\\n"");

                /* Exported library functions and function blocks */

                __asm__(".previous");


                #endif /* _BUR_1588951000_6_ */
                `;
            // simply invoke cowsay, use uri-path as text
            return header;
        }
    })();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("myScheme", myProvider));
    const uri = vscode.Uri.parse("myScheme:SomeTest.h");
    const doc = await vscode.workspace.openTextDocument(uri); // calls back into the provider
    await vscode.window.showTextDocument(doc, { preview: false });
}
