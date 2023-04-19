/**
 * Provides tasks for Br.As.Build.exe
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import * as BrDialogs from '../UI/BrDialogs';
import { logger } from '../Tools/Logger';
import { extensionConfiguration } from '../ExtensionConfiguration';
import { timeDiffString } from '../Tools/Helpers';
import { Environment } from '../Environment/Environment';
import { WorkspaceProjects } from '../Workspace/BRAsProjectWorkspace';


/**
 * Registers all task providers
 * @param context Extension context to push disposables
 */
export function registerTaskProviders(context: vscode.ExtensionContext): void {
    const disposable = vscode.tasks.registerTaskProvider(buildTaskTypeName, new BrAsBuildTaskProvider());
    context.subscriptions.push(disposable);
}


//#region definitions and types from package.json contribution points


/**
 * Task type name of BrAsBuild task provider
 */
//SYNC Needs to be in sync with package.json/contributes/taskDefinitions/[n]/type
const buildTaskTypeName = 'BrAsBuild';


/**
 * Problem matchers for BrAsBuild task
 */
//SYNC Needs to be in sync with package.json/contributes/problemMatchers/[n]/name
const buildTaskProblemMatchers = ['$BrAsBuild'];


/**
 * Literals to specify which can be used in BrAsBuildTaskDefinition for special functionality
 */
//SYNC Needs to be in sync with package.json/contributes/taskDefinitions/[n]/ description and enums
enum BrAsBuildLiterals{
    useSettings = '$useSettings',
}


/**
 * Task definition properties of BrAsBuild task provider
 */
//SYNC Needs to be in sync with defined properties of package.json/contributes/taskDefinitions/[n]/
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


//#region classes


/**
 * Task provider for BR.AS.Build.exe
 */
class BrAsBuildTaskProvider implements vscode.TaskProvider {
    /**
     * Used to provide standard tasks available in the workspace.
     * Tasks will be executed after selection without calling resolveTask().
     */
    public provideTasks(): vscode.Task[] | undefined {
        const result: vscode.Task[] = [];
        // task for undefined configuration
        const taskBuildWithDialogs = BrAsBuildTaskProvider.definitionToTask({
            type: buildTaskTypeName
        });
        result.push(taskBuildWithDialogs);
        // task to build cross reference
        const taskBuildCrossRef = BrAsBuildTaskProvider.definitionToTask({
            type:                 buildTaskTypeName,
            buildCrossReferences: true
        });
        result.push(taskBuildCrossRef);
        // task to clean project
        const taskCleanProject = BrAsBuildTaskProvider.definitionToTask({
            type:            buildTaskTypeName,
            cleanTemporary:  true,
            cleanBinary:     true,
            cleanGenerated:  true,
            cleanDiagnosis:  false
        });
        result.push(taskCleanProject);
        // return
        return result;
    }

    /**
     * Used to resolve the execution command, arguments and option for tasks from tasks.json or recently used tasks selection.
     * In this case the task is already predefined with the parameters, but does not have any execution details set.
     * This is not called when the task is executed in the selection dialog after provideTasks()
     * @param task The task from the tasks.json or the recently used selection.
     */
    public resolveTask(task: vscode.Task): vscode.Task | undefined {
        const asBuildDefinition = BrAsBuildTaskProvider.taskToDefinition(task);
        if (!asBuildDefinition) {
            return undefined;
        }
        const buildTask = BrAsBuildTaskProvider.definitionToTask(asBuildDefinition);
        buildTask.definition = task.definition; // resolveTask requires that the original definition object is used. Otherwise a new call to provideTasks is done.
        return buildTask;
    }


    /**
     * Extracts a BrAsBuildTaskDefinition from a task
     * @param task The task containing the definition
     * @returns undefined if task.definition is not a BrAsBuildTaskDefinition
     */
    private static taskToDefinition(task: vscode.Task): BrAsBuildTaskDefinition | undefined {
        if (task.definition.type !== buildTaskTypeName) {
            return undefined;
        }
        const asBuildDefinition: BrAsBuildTaskDefinition = task.definition as BrAsBuildTaskDefinition;
        return asBuildDefinition;
    }


    /**
     * Creates a build task for Br.As.Build.exe by using the task definition values.
     * @param definition The defined values of the task
     */
    private static definitionToTask(definition: BrAsBuildTaskDefinition): vscode.Task {
        // create execution and task
        const name = this.definitionToTaskName(definition);
        const customExec = new vscode.CustomExecution(async () => Promise.resolve(new BrAsBuildTerminal(definition)));
        const task = new vscode.Task(
            definition,                  // taskDefinition
            vscode.TaskScope.Workspace,  // scope
            name,                        // name
            buildTaskTypeName,       // source (type)
            customExec,                  // execution
            buildTaskProblemMatchers // problemMatchers
        );
        return task;
    }


    /**
     * Generates a task name from a task definition.
     * @param definition Definition for name generation
     */
    private static definitionToTaskName(definition: BrAsBuildTaskDefinition): string {
        const nameContents: string[] = [];
        // basic task type
        const isCleanTask =    definition.cleanBinary
                            || definition.cleanDiagnosis
                            || definition.cleanGenerated
                            || definition.cleanTemporary;
        const isCrossRefTask = definition.buildCrossReferences;
        if (isCleanTask) {
            nameContents.push('Clean');
        } else if (isCrossRefTask) {
            nameContents.push('Build cross references');
        } else {
            if (definition.asBuildMode === 'Rebuild') {
                nameContents.push('Rebuild');
            } else {
                nameContents.push('Build');
            }
        }
        // project, configuration...
        if (definition.asProjectFile) {
            nameContents.push(`of project: '${definition.asProjectFile}'`);
        }
        if (definition.asConfiguration) {
            nameContents.push(`for configuration: '${definition.asConfiguration}'`);
        }
        if (definition.buildForSimulation) {
            nameContents.push(`as simulation`);
        }
        if (definition.buildRUCPackage) {
            nameContents.push(`with RUC package`);
        }
        if (definition.additionalArguments) {
            nameContents.push(`additional arguments '${definition.additionalArguments.join(' ')}'`);
        }
        // return
        return nameContents.join(' ');
    }
}


/**
 * A Pseudoterminal which starts BR.AS.Build.exe on opening
 */
class BrAsBuildTerminal implements vscode.Pseudoterminal {
    private taskDefinition: BrAsBuildTaskDefinition;
    /** Event emitter for write events */
    private writeEmitter = new vscode.EventEmitter<string>();
    /** Event emitter for done signalling */
    private doneEmitter = new vscode.EventEmitter<number | void>();
    /** If set, a child process is active. Kill on user cancellation! */
    private buildProcess?: childProcess.ChildProcessWithoutNullStreams;


    /**
     * Creates a pseudoterminal which starts BR.AS.Build.exe on opening with the specified task definition.
     * Required but undefined task definition properties will prompt a user dialog for selection.
     * @param taskDefinition The task definition for the execution of BR.AS.Build.exe.
     */
    constructor(taskDefinition: BrAsBuildTaskDefinition) {
        this.taskDefinition = taskDefinition;
    }


    // The task should wait to do further execution until [Pseudoterminal.open](#Pseudoterminal.open) is called.
    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        void this.executeBuild(); //TODO it seems like the handling here for the promise... is not done well
         // TODO clarify async in #55
    }


    // Task cancellation should be handled using [Pseudoterminal.close](#Pseudoterminal.close).
    close(): void {
        if (this.buildProcess) {
            const killed = this.buildProcess.kill();
            if (!killed) {
                logger.warning('Failed to kill BR.AS.Build.exe');
            }
        }
    }


    // events to invoke for writing to UI and closing terminal
    onDidWrite = this.writeEmitter.event;
    onDidClose = this.doneEmitter.event;


    /**
     * Executes BR.AS.Build.exe and writes output to the terminal.
     */
    private async executeBuild(): Promise<void> {

        this.writeLine('Preparing Automation Studio build task');
        // get undefined values by dialog
        const usedDefinition = await processTaskDefinition(this.taskDefinition);
        if (!usedDefinition) {
            this.writeLine('Dialog cancelled by user or setting not found.');
            this.writeLine('No build will be executed.');
            this.done(41);
            return;
        }
        // Get project data to get BR.AS.Build.exe in matching version
        if (!usedDefinition.asProjectFile) {
            this.writeLine(`ERROR: No project file selected for build`);
            this.done(42);
            return;
        }
        const asProject = await WorkspaceProjects.getProjectForUri(vscode.Uri.file(usedDefinition.asProjectFile));
        if (!asProject) {
            this.writeLine(`ERROR: Project ${usedDefinition.asProjectFile} not found`);
            this.done(43);
            return;
        }
        if (asProject.workingVersion === undefined) {
            this.writeLine(`ERROR: No AS version defined in "${asProject.paths.projectFile.fsPath}"`);
            this.done(44);
            return;
        }
        const buildExe = (await Environment.automationStudio.getVersion(asProject.workingVersion))?.buildExe.exePath; //TODO strict search?
        if (!buildExe) {
            this.writeLine(`ERROR: BR.AS.Build.exe not found for AS Version: ${asProject.workingVersion}`);
            this.done(45);
            return;
        }
        // start build process
        const startTime = new Date();
        this.writeLine('Starting Automation Studio build task');
        this.writeLine(`Start of build: ${startTime.toLocaleString()}`);
        const buildArgs = taskDefinitionToBuildArgs(usedDefinition);
        this.writeLine(`${buildExe.fsPath} ${buildArgs.join(' ')}`);
        this.writeLine();
        this.buildProcess = childProcess.spawn(buildExe.fsPath, buildArgs);
        // print data with timestamp on data
        this.buildProcess.stdout.on('data', (data) => {
            const time = new Date().toLocaleTimeString();
            const dataStr = String(data);
            this.write(`${time} ${dataStr}`);
        });
        this.buildProcess.stderr.on('data', (data) => {
            const time = new Date().toLocaleTimeString();
            const dataStr = String(data);
            this.write(`${time} ${dataStr}`);
        });
        // print build duration on exit
        this.buildProcess.on('exit', (code) => {
            const endTime = new Date();
            const durationStr = timeDiffString(startTime, endTime);
            this.writeLine();
            this.writeLine(`End of build: ${endTime.toLocaleString()}`);
            this.writeLine(`Build duration: ${durationStr}`);
            this.done(code ?? 0);
        });
    }


    /**
     * Writes to the terminal
     * @param text Text to write
     */
    private write(text?: string): void {
        this.writeEmitter.fire(text ?? '');
    }

    /**
     * Writes to the terminal and appends a new line
     * @param text Text to write
     */
    private writeLine(text?: string): void {
        this.write(text);
        this.write('\r\n');
    }


    /**
     * Signals that the terminals execution is done.
     * @param exitCode The exit code of the terminal
     */
    private done(exitCode?: number | void): void {
        this.buildProcess = undefined;
        this.doneEmitter.fire(exitCode);
    }
}


//#endregion classes


//#region local functions


/**
 * Replaces specified values of a BrAsBuildTaskDefinition
 * @param baseDef The base definition
 * @param withDef The properties which should be replaced
 */
function taskDefinitionWith(baseDef: BrAsBuildTaskDefinition, withDef: BrAsBuildTaskDefinition): BrAsBuildTaskDefinition {
    return {
        type:                 withDef.type                 ?? baseDef.type,
        asProjectFile:        withDef.asProjectFile        ?? baseDef.asProjectFile,
        asBuildMode:          withDef.asBuildMode          ?? baseDef.asBuildMode,
        asConfiguration:      withDef.asConfiguration      ?? baseDef.asConfiguration,
        buildForSimulation:   withDef.buildForSimulation   ?? baseDef.buildForSimulation,
        buildRUCPackage:      withDef.buildRUCPackage      ?? baseDef.buildRUCPackage,
        buildCrossReferences: withDef.buildCrossReferences ?? baseDef.buildCrossReferences,
        cleanTemporary:       withDef.cleanTemporary       ?? baseDef.cleanTemporary,
        cleanBinary:          withDef.cleanBinary          ?? baseDef.cleanBinary,
        cleanGenerated:       withDef.cleanGenerated       ?? baseDef.cleanGenerated,
        cleanDiagnosis:       withDef.cleanDiagnosis       ?? baseDef.cleanDiagnosis,
        additionalArguments:  withDef.additionalArguments  ?? baseDef.additionalArguments,
    };
}


/**
 * Processes a raw task definition by searching and replacing empty values or special literals within the baseDefinition.
 * @param baseDefinition The base definition which is extended.
 * @returns A new BrAsBuildTaskDefinition with additional and modified properties, or undefined if processing failed.
 */
async function processTaskDefinition(baseDefinition: BrAsBuildTaskDefinition): Promise<BrAsBuildTaskDefinition | undefined> {
    //TODO add evaluation of VS Code variables. e.g. "asProjectFile": "${workspaceFolder}/AsTestPrj.apj
    const withSettings = processTaskDefinitionWithSettings(baseDefinition);
    if (!withSettings) {
        return undefined;
    }
    const withDialogs = await processTaskDefinitionWithDialogs(withSettings);
    return withDialogs;
}


/**
 * Fills properties which are set BrAsBuildLiterals.UseSettings by getting the corresponding setting value.
 * @param baseDefinition The base definition which is extended.
 * @returns A new BrAsBuildTaskDefinition with properties from settings, or undefined if a setting was not found.
 */
function processTaskDefinitionWithSettings(baseDefinition: BrAsBuildTaskDefinition): BrAsBuildTaskDefinition | undefined {
    // build mode
    let asBuildMode = baseDefinition.asBuildMode;
    if (asBuildMode === BrAsBuildLiterals.useSettings) {
        asBuildMode = extensionConfiguration.build.defaultBuildMode;
        if (!asBuildMode) {
            return undefined;
        }
    }
    // apply setting values
    return taskDefinitionWith(baseDefinition,
        {
            type:        baseDefinition.type,
            asBuildMode: asBuildMode
        });
}


/**
 * Fills undefined properties of a task definition by prompting dialogs to the user.
 * @param baseDefinition The base definition which is extended.
 * @returns A new BrAsBuildTaskDefinition with additional properties from dialogs, or undefined if a dialog was cancelled.
 */
async function processTaskDefinitionWithDialogs(baseDefinition: BrAsBuildTaskDefinition): Promise<BrAsBuildTaskDefinition | undefined> {
    // Project file
    let asProjectFile = baseDefinition.asProjectFile;
    if (!asProjectFile) {
        asProjectFile = (await BrDialogs.selectAsProjectFromWorkspace())?.paths.projectFile.fsPath;
        if (!asProjectFile) {
            return undefined;
        }
    }
    // Configuration
    let asConfiguration = baseDefinition.asConfiguration;
    if (!asConfiguration) {
        const asProject = await WorkspaceProjects.getProjectForUri(vscode.Uri.file(asProjectFile));
        if (!asProject) {
            return undefined;
        }
        const selectedConfiguration = await BrDialogs.selectASProjectConfiguration(asProject);
        asConfiguration = selectedConfiguration?.name;
        if (!asConfiguration) {
            return undefined;
        }
    }
    // Build mode
    const isCleanTask =    baseDefinition.cleanBinary
                        || baseDefinition.cleanDiagnosis 
                        || baseDefinition.cleanGenerated
                        || baseDefinition.cleanTemporary;
    const isCrossRefTask = baseDefinition.buildCrossReferences;
    let asBuildMode = baseDefinition.asBuildMode;
    if (!isCleanTask && !isCrossRefTask && !asBuildMode) {
        asBuildMode = await BrDialogs.selectBuildMode();
        if (!asBuildMode) {
            return undefined;
        }
    }
    // apply dialog values
    return taskDefinitionWith(baseDefinition, 
        {
            type: baseDefinition.type,
            asProjectFile: asProjectFile,
            asConfiguration: asConfiguration,
            asBuildMode: asBuildMode
        });
}


/**
 * Creates the build arguments required for BR.AS.Build.exe based on a task definition.
 */
function taskDefinitionToBuildArgs(definition: BrAsBuildTaskDefinition): string[] {
    const buildArgs: string[] = [];
    if (definition.asProjectFile) {
        buildArgs.push(definition.asProjectFile);
    }
    if (definition.asConfiguration && definition.asConfiguration !== '') {
        buildArgs.push('-c');
        buildArgs.push(definition.asConfiguration);
    }
    if (definition.asBuildMode && definition.asBuildMode !== '') {
        buildArgs.push('-buildMode');
        buildArgs.push(definition.asBuildMode);
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
    return buildArgs;
}


//#endregion local functions