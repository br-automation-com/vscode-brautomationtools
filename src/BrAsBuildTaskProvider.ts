/**
 * Provides tasks for Br.As.Build.exe
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import * as BRAsProjectWorkspace from './BRAsProjectWorkspace';
import * as Helpers from './Helpers';

//#region definitions and types from package.json contribution points
/**
 * Task type name of BrAsBuild task provider
 */
// Needs to be in synch with package.json/contributes/taskDefinitions/[n]/type
const BrAsBuildTaskType = 'BrAsBuild';

/**
 * Literal to specify the use of a dialog to get the value
 */
// Needs to be in synch with package.json/contributes/taskDefinitions/[n]/ description and enums
const BrAsBuildUseDialog = '$dialog';

/**
 * Task definition properties of BrAsBuild task provider
 */
// Needs to be in synch with defined properties of package.json/contributes/taskDefinitions/[n]/
interface BrAsBuildTaskDefinition extends vscode.TaskDefinition {
    /** The (absolute?) path of the Automation Studio project file */
    readonly asProjectFile?: string;

    /** The build mode for this task */
    readonly asBuildMode?: string;

    /** The AS configuration which will be built */
    readonly asConfiguration?: string;

    /** Always build project for ArSim target. */
    readonly buildForSimulation?: boolean;

    /** Always create RUC package. */
    readonly buildRUCPackage?: boolean;

    /** Build only cross reference and header files. */
    readonly buildCrossReferences?: boolean;

    /** Cleans the temporary folder. */
    readonly cleanTemporary?: boolean;

    /** Cleans the binaries folder. */
    readonly cleanBinary?: boolean;

    /** Cleans all generated .h and .a files. */
    readonly cleanGenerated?: boolean;

    /** Cleans the diagnosis folder. */
    readonly cleanDiagnosis?: boolean;

    /** Additional arguments for Br.As.Build.exe */
    readonly additionalArguments?: string[];
}
//#endregion definitions and types from package.json contribution points

/**
 * Registers all task providers
 * @param context Extension context to push disposables
 */
export function registerTaskProviders(context: vscode.ExtensionContext) {
    let disposable: vscode.Disposable | undefined;
    let tmpPath = vscode.workspace.rootPath;
    if (!tmpPath) {
        return;
    }
    disposable = vscode.tasks.registerTaskProvider(BrAsBuildTaskType, new BrAsBuildTaskProvider());
    context.subscriptions.push(disposable);
}


class BrAsBuildTaskProvider implements vscode.TaskProvider {

    //#region vscode.TaskProvider interface implementation
    /**
     * Used to provide standard tasks available in the workspace. Tasks will be executed after selection
     */
    public async provideTasks(): Promise<vscode.Task[] | undefined> {
        Helpers.logTimedHeader('provideTasks');
        const result: vscode.Task[] = [];
        // task for undefined configuration
        const taskBuildWithDialogs = await BrAsBuildTaskProvider.definitionToTask({
            type:            BrAsBuildTaskType,
            asBuildMode:     BrAsBuildUseDialog,
            asConfiguration: BrAsBuildUseDialog
        }, 'Build with dialogs');
        Helpers.pushDefined(result, taskBuildWithDialogs);
        // task to build cross reference
        const taskBuildCrossRef = await BrAsBuildTaskProvider.definitionToTask({
            type:                BrAsBuildTaskType,
            asConfiguration:     BrAsBuildUseDialog,
            buildCrossReferences: true
        }, 'Build cross reference');
        Helpers.pushDefined(result, taskBuildCrossRef);
        // task to clean project
        const taskCleanProject = await BrAsBuildTaskProvider.definitionToTask({
            type:            BrAsBuildTaskType,
            asConfiguration: BrAsBuildUseDialog,
            cleanTemporary:  true,
            cleanBinary:     true,
            cleanGenerated:  true,
            cleanDiagnosis:  false
        }, 'Clean project');
        Helpers.pushDefined(result, taskCleanProject);
        // task for each configuration
        const configurations = await BRAsProjectWorkspace.getAvailableConfigurations() ?? [];
        for (const config of configurations) {
            const taskDefinedAsConfig = await BrAsBuildTaskProvider.definitionToTask({
                type:            BrAsBuildTaskType,
                asBuildMode:     BrAsBuildUseDialog,
                asConfiguration: config
            });
            Helpers.pushDefined(result, taskDefinedAsConfig);
        }
        return result;
    }

    /**
     * Used to resolve the execution command, arguments and option for tasks from Tasks.json or last used tasks selection.
     * In this case the task is already predefined with the parameters, but does not have any execution details set.
     * This is not called when the task is executed in the selection dialog of "Run Task"
     * @param task The task from the configuration or the quick selection
     */
    public async resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
        Helpers.logTimedHeader('resolveTask');
        console.log(task);
        const asBuildDefinition = BrAsBuildTaskProvider.taskToDefinition(task);
        if (!asBuildDefinition) {
            return undefined;
        }
        const buildTask = await BrAsBuildTaskProvider.definitionToTask(asBuildDefinition);
        if (buildTask) {
            // resolveTask requires that the original definition object is used. Otherwise a new call to provideTasks is done.
            buildTask.definition = task.definition;
        }
        return buildTask;
    }
    //#endregion vscode.TaskProvider interface implementation

    //#region internal helper functions
    private static taskToDefinition(task: vscode.Task): BrAsBuildTaskDefinition | undefined {
        if (task.definition.type !== BrAsBuildTaskType) {
            return undefined;
        }
        const asBuildDefinition: BrAsBuildTaskDefinition = task.definition as BrAsBuildTaskDefinition;
        return asBuildDefinition;
    }

    /**
     * Creates a build task for Br.As.Build.exe by using the task definition values.
     * @param definition The defined values of the task
     * @param dialogsAllowed If set to true, undefined values will directly prompt a dialog for the user to select a value
     */
    private static async definitionToTask(definition: BrAsBuildTaskDefinition, name?: string): Promise<vscode.Task | undefined> {
        Helpers.logTimedHeader('createAsBuildTask');
        console.log(definition);
        // get defined properties and use default values / dialogs for undefined properties
        let usedAsProjectPath = definition.asProjectFile ?? (await getAsProjectFile())?.fsPath;
        if (!usedAsProjectPath) {
            return undefined;
        }
        let usedAsConfiguration = definition.asConfiguration;
        if (usedAsConfiguration && usedAsConfiguration === BrAsBuildUseDialog) {
            usedAsConfiguration = '${command:vscode-brautomationtools.dialogSelectASProjectConfiguration}';
        }
        let usedAsBuildMode = definition.asBuildMode;
        if (usedAsBuildMode && usedAsBuildMode === BrAsBuildUseDialog) {
            usedAsBuildMode = '${command:vscode-brautomationtools.dialogSelectBuildMode}';
        }
        // get build executable
        const buildExecutable = await getRequiredAsBuildExe(vscode.Uri.file(usedAsProjectPath));
        if (!buildExecutable) {
            return undefined;
        }
        // create build arguments
        const buildArgs: string[] = [];
        buildArgs.push(usedAsProjectPath);
        if (usedAsConfiguration && usedAsConfiguration !== '') {
            buildArgs.push('-c');
            buildArgs.push(usedAsConfiguration);
        }
        if (usedAsBuildMode && usedAsBuildMode !== '') {
            buildArgs.push('-buildMode');
            buildArgs.push(usedAsBuildMode);
        }
        if (definition.buildForSimulation ?? false) {
            buildArgs.push('-simulation');
        }
        if (definition.buildRUCPackage ?? false) {
            buildArgs.push('-buildRUCPackage');
        }
        if (definition.buildCrossReferences ?? false) {
            buildArgs.push('-X');
        }
        if (definition.cleanTemporary ?? false) {
            buildArgs.push('-clean-temporary');
        }
        if (definition.cleanBinary ?? false) {
            buildArgs.push('-clean-binary');
        }
        if (definition.cleanGenerated ?? false) {
            buildArgs.push('-clean-generated');
        }
        if (definition.cleanDiagnosis ?? false) {
            buildArgs.push('-clean-diagnosis');
        }
        if (definition.additionalArguments) {
            buildArgs.push(...definition.additionalArguments);
        }
        // create name
        let usedName = name;
        if (!usedName) {
            usedName  = 'Configuration: ';
            usedName += definition.asConfiguration ?? 'NONE';
            usedName += '; Mode: ';
            usedName += definition.asBuildMode ?? 'NONE';
        }
        // create shell and task
        const shellExec = new vscode.ShellExecution(buildExecutable, buildArgs);
        const problemMatchers = ['$BrAsBuild'];
        const task = new vscode.Task(
            definition,                 // taskDefinition
            vscode.TaskScope.Workspace, // scope
            usedName,                   // name
            BrAsBuildTaskType,          // source (type)
            shellExec,                  // execution
            problemMatchers             // problemMatchers
        );

        console.log(task);
        return task;
    }
    //#endregion internal helper functions
}





//#region getter functions for environment which need to be moved and properly implemented
async function getRequiredAsBuildExe(projectFile: vscode.Uri): Promise<string | undefined> {
    //TODO move to proper place and implement poperly, in case Br.As.Build.exe is not found, return undefined
    return 'C:/BrAutomation/AS46/Bin-en/BR.AS.Build.exe';
}

async function getAsProjectFile(): Promise<vscode.Uri | undefined> {
    //TODO move to proper place and implement poperly, in case no project file is found, return undefined
    return vscode.Uri.file('C:\\Data\\Project\\Own\\VSCode\\vscode-brAutomationToolsTest\\AsTestPrj.apj');
}
//#endregion getter functions for environment which need to be moved and properly implemented