/* eslint-disable */
/**
 * TEMPLATE
 * @packageDocumentation
 */

import * as vscode from "vscode";

//#region exported types

/**
 * TEMPLATE
 */
export interface TEMPLATE_IF {
    /** TEMPLATE */
    template: string;
}

//#endregion exported types

//#region exported functions

/**
 * Activation of TEMPLATE
 * @param context context to register disposables
 */
export async function activateTEMPLATE(context: vscode.ExtensionContext) {
    let disposable: vscode.Disposable;
    //disposable = vscode.workspace.XXXX
    //context.subscriptions.push(disposable);
}

/**
 * TEMPLATE
 */
export async function TEMPLATE_FUN(): Promise<string> {
    return "aaaa";
}

//#endregion exported functions

//#region local variables

/** TEMPLATE */
//TODO put functionality in a class to save state, or are local variables like this OK?
let _TEMPLATE_LOCVAR: Promise<string> = TEMPLATE_FUN();

//#endregion local variables

//#region local types

/** TEMPLATE */
enum TEMPLATE_LOC_ENUM {
    /** TEMPLATE 1  */
    TEMPLATE_0,
    /** TEMPLATE 2 */
    TEMPLATE_1,
}

//#endregion local types

//#region local functions

/**
 * TEMPLATE
 */
async function TEMPLATE_LOCFUN(): Promise<string> {
    return "result";
}

//#endregion local functions
