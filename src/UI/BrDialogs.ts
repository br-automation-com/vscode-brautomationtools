/**
 * B&R extension specific dialogs
 * @packageDocumentation
 */

import { extensionConfiguration } from "../ExtensionConfiguration";
import { urisEqual } from "../Tools/UriTools";
import { AsProject } from "../Workspace/AsProject";
import { AsProjectConfiguration } from "../Workspace/AsProjectConfiguration";
import { WorkspaceProjects } from "../Workspace/BRAsProjectWorkspace";
import { ValueQuickPickInitialValues, ValueQuickPickItem, ValueQuickPickOptions, getQuickPickSingleValue } from "./Dialogs";

/**
 * Dialog to select a project from all projects within the workspace.
 */
export async function selectAsProjectFromWorkspace(): Promise<AsProject | undefined> {
    // get items
    const projectsData = await WorkspaceProjects.getProjects();
    const projectItems = projectsData.map((data) => {
        const item: ValueQuickPickItem<AsProject> = {
            label: `${data.name} in ${data.paths.projectRoot.fsPath}`,
            detail: data.description,
            value: data,
        };
        return item;
    });
    // set options and get value
    const pickOptions: ValueQuickPickOptions = {
        title: "Select project",
        autoSelectSingleValue: true,
    };
    const pickInitial = undefined;
    return await getQuickPickSingleValue(projectItems, pickOptions, pickInitial);
}

/**
 * Dialog to select an AS configuration out of all available AS configurations in the AS project
 */
export async function selectASProjectConfiguration(asProject: AsProject): Promise<AsProjectConfiguration | undefined> {
    // get items and initial value
    const configurationValues = asProject.configurations;
    const configurationItems = configurationValues.map((config) => {
        const item: ValueQuickPickItem<AsProjectConfiguration> = {
            label: config.name,
            detail: config.description,
            value: config,
        };
        return item;
    });
    const activeConfigurationItem = configurationItems.find((item) => urisEqual(item.value.rootPath, asProject.activeConfiguration?.rootPath));
    if (activeConfigurationItem) {
        activeConfigurationItem.label += " (ACTIVE)";
    }
    // set options and get value
    const pickOptions: ValueQuickPickOptions = { title: "Select configuration" };
    const pickInitial: ValueQuickPickInitialValues<AsProjectConfiguration> = { activeItems: activeConfigurationItem };
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
        { label: "Build", detail: "Incremental build", value: "Build" },
        { label: "Rebuild", detail: "Complete rebuild", value: "Rebuild" },
        { label: "BuildAndTransfer", detail: "Build for transfer", value: "BuildAndTransfer" },
        { label: "BuildAndCreateCompactFlash", detail: "Build for creation of CF card", value: "BuildAndCreateCompactFlash" },
    ];
    const defaultBuildModeValue = extensionConfiguration.build.defaultBuildMode;
    const defaultBuildModeItem = buildModeItems.find((mode) => mode.value === defaultBuildModeValue);
    // set options and initial values
    const pickOptions = <ValueQuickPickOptions>{ title: "Select build mode" };
    const pickInitial = <ValueQuickPickInitialValues<string>>{ activeItems: defaultBuildModeItem };
    // get selected value
    const selectedBuildMode = await getQuickPickSingleValue(buildModeItems, pickOptions, pickInitial);
    return selectedBuildMode;
}
