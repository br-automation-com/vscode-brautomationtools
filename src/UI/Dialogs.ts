/**
 * General dialogs without dependencies to B&R specifics
 * @packageDocumentation
 */

import * as vscode from 'vscode';


//#region exported types for a quick pick


/**
 * A QuickPickItem that contains an additional value, which is not shown in the dialog
 */
export interface ValueQuickPickItem<T> extends vscode.QuickPickItem {
    value: T;
}


/**
 * Options for a value quick pick dialog
 */
export interface ValueQuickPickOptions {
    /** Title of the dialog */
    title?: string;
    titleCurrentStep?: number;
    titleTotalSteps?: number;
    placeholder?: string;
    ignoreFocusOut?: boolean;
    matchOnDescription?: boolean;
    matchOnDetail?: boolean;
    /** If the items array only contains one value, this value is automatically selected without prompting a dialog */
    autoSelectSingleValue?: boolean;
}


/**
 * Initial values on opening of dialog.
 */
export interface ValueQuickPickInitialValues<T> {
    /** Initial value of the filter text */
    filterText?: string;
    /** Items with focus on opening of dialog. */
    activeItems?: ValueQuickPickItem<T>[] | ValueQuickPickItem<T>/* | T*/; //TODO maybe also values
    /** Items which are already selected on opening of dialog. this has no effect without multi selection */
    selectedItems?: ValueQuickPickItem<T>[] | ValueQuickPickItem<T>/* | T*/; //TODO maybe also values
}


//#endregion exported types for a quick pick


//#region exported functions for a quick pick


/**
 * Show a quick pick and get all selected values
 * @param items Items to pick from
 * @param options Options for the quick pick dialog
 * @param initialValues Initial values of the quick pick dialog
 * @param multiSelect Allow selection of multiple values. Defaults to true.
 */
export async function getQuickPickValues<T>(items: ValueQuickPickItem<T>[], options?: ValueQuickPickOptions, initialValues?: ValueQuickPickInitialValues<T>, multiSelect = true): Promise<T[] | undefined> {
    // direct return on empty items
    if (items.length === 0) {
        return undefined;
    }
    // auto select single value
    if (options?.autoSelectSingleValue) {
        if (items.length === 1) {
            return [items[0].value];
        }
    }
    // set dialog options
    const picker = vscode.window.createQuickPick<ValueQuickPickItem<T>>();
    // apply input parameters to picker
    picker.items = items;
    picker.canSelectMany = multiSelect;
    // apply options input parameters to picker
    picker.title = options?.title;
    picker.step = options?.titleCurrentStep;
    picker.totalSteps = options?.titleTotalSteps;
    picker.placeholder = options?.placeholder;
    picker.ignoreFocusOut = options?.ignoreFocusOut ?? picker.ignoreFocusOut;
    picker.matchOnDescription = options?.matchOnDescription ?? picker.matchOnDescription;
    picker.matchOnDetail = options?.matchOnDetail ?? picker.matchOnDetail;
    // apply initial values
    picker.value = initialValues?.filterText ?? '';
    let activeItems: ValueQuickPickItem<T>[] = [];
    if (initialValues?.activeItems !== undefined) {
        activeItems = activeItems.concat(initialValues?.activeItems);
    }
    picker.activeItems = activeItems;
    let selectedItems: ValueQuickPickItem<T>[] = [];
    if (initialValues?.selectedItems !== undefined) {
        selectedItems = selectedItems.concat(initialValues?.selectedItems);
    }
    picker.selectedItems = selectedItems;
    // TODO how to affect these? create callbacks for changing?
    // let busy : boolean = picker.busy; // false
    // let enabled : boolean = picker.enabled; // true
    // let buttons : readonly vscode.QuickInputButton[] = picker.buttons; // Array[0]
    // show dialog and get selected values
    try {
        return await new Promise<T[] | undefined>((resolve, reject) => {
            picker.onDidChangeSelection((items) => {
                // Maybe do some validation here in the future. Maybe input for callbacks?
            });
            picker.onDidAccept(() => {
                resolve(picker.selectedItems.map((i) => i.value));
                picker.dispose();
            });
            picker.onDidHide(() => {
                resolve(undefined);
                picker.dispose();
            });
            picker.show();
        });

    } finally {
        picker.dispose();
    }
}


/**
 * Show a quick pick without multiple value selection and get the selected value.
 * @param items Items to pick from
 * @param options Options for the quick pick dialog
 * @param initialValues Initial values of the quick pick dialog
 */
export async function getQuickPickSingleValue<T>(items: ValueQuickPickItem<T>[], options?: ValueQuickPickOptions, initialValues?: ValueQuickPickInitialValues<T>): Promise<T | undefined> {
    const values = await getQuickPickValues(items, options, initialValues, false);
    return values ? values[0] : undefined;
}


/**
 * A dialog which presents a "yes" and "no" option
 * @param prompt Prompt message which will be displayed
 * @return A promise that resolves to `true` if 'yes' was selected, to `false` if 'no' was selected and undefined if the dialog was cancelled.
 */
export async function yesNoDialog(prompt?: string): Promise<boolean | undefined> {
    const selected = await vscode.window.showQuickPick(['no', 'yes'], {placeHolder: prompt});
    if (!selected) {
        return undefined;
    } else {
        return selected === 'yes';
    }
}


//#endregion exported functions for a quick pick