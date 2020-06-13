/**
 * User input and output dialogs
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import * as BRAsProjectWorkspace from './BRAsProjectWorkspace';
import * as BRConfiguration from './BRConfiguration';


/**
 * Dialog to select a project from all projects within the workspace.
 */
export async function selectAsProjectFromWorkspace(): Promise<BRAsProjectWorkspace.AsProjectInfo | undefined> {
    // get items
    const projectsData = await BRAsProjectWorkspace.getWorkspaceProjects();
    const projectItems = projectsData.map(data => {
        const item: ValueQuickPickItem<BRAsProjectWorkspace.AsProjectInfo> = {
            label:  `${data.name} in ${data.baseUri.fsPath}`,
            detail: data.description,
            value:  data
        };
        return item;
    });
    // set options and get value
    const pickOptions: ValueQuickPickOptions = {
        title: 'Select project',
        autoSelectSingleValue: true
    };
    const pickInitial = undefined;
    return await getQuickPickSingleValue(projectItems, pickOptions, pickInitial);
}


/**
 * Dialog to select an AS configuration out of all available AS configurations in the AS project
 */
export async function selectASProjectConfiguration(asProject: BRAsProjectWorkspace.AsProjectInfo): Promise<BRAsProjectWorkspace.AsConfigurationInfo | undefined> {
    // get items and initial value
    const configurationValues = asProject.configurations;
    const configurationItems = configurationValues.map(config => {
        const item: ValueQuickPickItem<BRAsProjectWorkspace.AsConfigurationInfo> = {
            label:  config.name,
            detail: config.description,
            value:  config
        };
        return item;
    });
    const activeConfigurationValue = await BRAsProjectWorkspace.getActiveConfiguration(asProject);
    const activeConfigurationItem = configurationItems.find(item => item.value.baseUri.toString() === activeConfigurationValue?.baseUri.toString());
    // set options and get value
    const pickOptions: ValueQuickPickOptions = { title: 'Select configuration' };
    const pickInitial: ValueQuickPickInitialValues<BRAsProjectWorkspace.AsConfigurationInfo> = { activeItems: activeConfigurationItem };
    // get selected value
    return await getQuickPickSingleValue(configurationItems, pickOptions, pickInitial);
}

/**
 * Dialog to select the AS build mode
 */
export async function selectBuildMode(): Promise<string | undefined> {
    // get build modes and default build mode
    //const buildModes = BRConfiguration.getAllowedBuildModes();
    const buildModeItems: ValueQuickPickItem<string>[] = [
        { label: 'Build', detail: 'Incremental build', value: 'Build' },
        { label: 'Rebuild', detail: 'Complete rebuild', value: 'Rebuild' },
        { label: 'BuildAndTransfer', detail: 'Build for transfer', value: 'BuildAndTransfer' },
        { label: 'BuildAndCreateCompactFlash', detail: 'Build for creation of CF card', value: 'BuildAndCreateCompactFlash' }
    ];
    const defaultBuildModeValue = BRConfiguration.getDefaultBuildMode();
    const defaultBuildModeItem = buildModeItems.find(mode => mode.value === defaultBuildModeValue);
    // set options and initial values
    const pickOptions = <ValueQuickPickOptions>{ title: 'Select build mode' };
    const pickInitial = <ValueQuickPickInitialValues<string>>{ activeItems: defaultBuildModeItem };
    // get selected value
    const selectedBuildMode = await getQuickPickSingleValue(buildModeItems, pickOptions, pickInitial);
    return selectedBuildMode;
}

//#region internal dialog helpers
/**
 * A QuickPickItem that contains an additional value, which is not shown in the dialog
 */
interface ValueQuickPickItem<T> extends vscode.QuickPickItem {
    value: T;
};

/**
 * Options for a value quick pick dialog
 */
interface ValueQuickPickOptions {
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
interface ValueQuickPickInitialValues<T> {
    /** Initial value of the filter text */
    filterText?: string;
    /** Items with focus on opening of dialog. */
    activeItems?: ValueQuickPickItem<T>[] | ValueQuickPickItem<T>/* | T*/; //TODO maybe also values
    /** Items which are already selected on opening of dialog. this has no effect without multi selection */
    selectedItems?: ValueQuickPickItem<T>[] | ValueQuickPickItem<T>/* | T*/; //TODO maybe also values
}

/**
 * Show a quick pick and get all selected values
 * @param items Items to pick from
 * @param options Options for the quick pick dialog
 * @param initialValues Initial values of the quick pick dialog
 * @param multiSelect Allow selection of multiple values. Defaults to true.
 */
async function getQuickPickValues<T>(items: ValueQuickPickItem<T>[], options?: ValueQuickPickOptions, initialValues?: ValueQuickPickInitialValues<T>, multiSelect = true): Promise<T[] | undefined> {
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
                resolve(picker.selectedItems.map(i => i.value));
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
async function getQuickPickSingleValue<T>(items: ValueQuickPickItem<T>[], options?: ValueQuickPickOptions, initialValues?: ValueQuickPickInitialValues<T>): Promise<T | undefined> {
    const values = await getQuickPickValues(items, options, initialValues, false);
    return values ? values[0] : undefined;
}
//#endregion internal dialog helpers