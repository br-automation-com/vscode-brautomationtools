/**
 * B&R extension specific dialogs
 * @packageDocumentation
 */

import {ValueQuickPickItem, ValueQuickPickOptions, ValueQuickPickInitialValues, getQuickPickSingleValue} from './Dialogs';
import * as BRAsProjectWorkspace from '../Workspace/BRAsProjectWorkspace';
import { extensionConfiguration } from '../ExtensionConfiguration';


/**
 * Dialog to select a project from all projects within the workspace.
 */
export async function selectAsProjectFromWorkspace(): Promise<BRAsProjectWorkspace.AsProjectInfo | undefined> {
    // get items
    const projectsData = await BRAsProjectWorkspace.getWorkspaceProjects();
    const projectItems = projectsData.map((data) => {
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
    const configurationItems = configurationValues.map((config) => {
        const item: ValueQuickPickItem<BRAsProjectWorkspace.AsConfigurationInfo> = {
            label:  config.name,
            detail: config.description,
            value:  config
        };
        return item;
    });
    const activeConfigurationItem = configurationItems.find((item) => item.value.baseUri.toString() === asProject.activeConfiguration?.baseUri.toString());
    if (activeConfigurationItem) {
        activeConfigurationItem.label += ' (ACTIVE)';
    }
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
    const defaultBuildModeValue = extensionConfiguration.build.defaultBuildMode;
    const defaultBuildModeItem = buildModeItems.find((mode) => mode.value === defaultBuildModeValue);
    // set options and initial values
    const pickOptions = <ValueQuickPickOptions>{ title: 'Select build mode' };
    const pickInitial = <ValueQuickPickInitialValues<string>>{ activeItems: defaultBuildModeItem };
    // get selected value
    const selectedBuildMode = await getQuickPickSingleValue(buildModeItems, pickOptions, pickInitial);
    return selectedBuildMode;
}