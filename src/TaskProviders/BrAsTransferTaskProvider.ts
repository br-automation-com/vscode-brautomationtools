/**
 * Provides tasks for Br.As.Build.exe
 * @packageDocumentation
 */

//TODO Better build / transfer experience
//     add some variables "lastBuiltConfiguration" and "lastBuiltTimeStamp" and add a literal "$lastBuiltConfiguration"
//     This will enable the automatic selection of the last built configuration and prevents asking for the configuration
//     multiple times when the transfer task is set to depend on the build task ("dependsOn" property in tasks.json)
//     -> nice and clean build / transfer chain

import * as vscode from "vscode";
import * as childProcess from "child_process";
import * as Helpers from "../Tools/Helpers";
import * as uriTools from "../Tools/UriTools";
import * as fileTools from "../Tools/FileTools";
import * as Dialogs from "../UI/Dialogs";
import * as BrDialogs from "../UI/BrDialogs";
import { logger } from "../Tools/Logger";
import { Environment } from "../Environment/Environment";
import { WorkspaceProjects } from "../Workspace/BRAsProjectWorkspace";

/**
 * Registers all task providers
 * @param context Extension context to push disposables
 */
export function registerTaskProviders(context: vscode.ExtensionContext): void {
    const disposable = vscode.tasks.registerTaskProvider(transferTaskTypeName, new BrAsTransferTaskProvider());
    context.subscriptions.push(disposable);
}

//#region definitions and types from package.json contribution points

/**
 * Task type name of BrAsTransfer task provider
 */
//SYNC Needs to be in sync with package.json/contributes/taskDefinitions/[n]/type
const transferTaskTypeName = "BrAsTransfer";

/**
 * Problem matchers for BrAsTransfer task
 */
//SYNC Needs to be in sync with package.json/contributes/problemMatchers/[n]/name
//TODO create problem matcher for PIL execution
const transferTaskProblemMatchers = ["$BrAsBuild"];

/**
 * Literals to specify which can be used in BrAsTransferTaskDefinition for special functionality
 */
//SYNC Needs to be in sync with package.json/contributes/taskDefinitions/[n]/ description and enums
//TODO package.json
// eslint-disable-next-line @typescript-eslint/no-unused-vars
enum BrAsTransferLiterals {
    useSettings = "$useSettings",
    lastBuiltConfiguration = "$lastBuiltConfig", //TODO implement
}

/**
 * Task definition properties of BrAsTransfer task provider
 */
//SYNC Needs to be in sync with defined properties of package.json/contributes/taskDefinitions/[n]/
//TODO package.json
interface BrAsTransferTaskDefinition extends vscode.TaskDefinition {
    /** The (absolute?) path of the Automation Studio project file */
    readonly asProjectFile?: string;

    /** The AS configuration which will be transfered */
    readonly asConfiguration?: string;

    /** Settings for PVI connection */
    readonly pviConnectionSettings?: {
        /** Interface type of the device (e.g. tcpip) (/IF parameter) */
        deviceInterface?: string;

        /** INA source node number for the connection. This value should differ from your AS connection to prevent connection losses (/SA parameter) */
        sourceNode?: number;

        /** Address of the transfer destination. Can be an IP address or a host name (/IP parameter) */
        destinationAddress?: string;

        /** Port of the transfer destination. Default ANSL port is 11169 (/PT parameter) */
        destinationPort?: number;

        /** Communication timeout in ms (/COMT parameter) */
        communicationTimeout?: number;

        /** Additional PVI device parameters (e.g. `/IF`, `/BD`, `/RS`) */
        additionalDeviceParameters?: string;

        /** Additional PVI CPU parameters (e.g. `/AM`, `/IP`) */
        additionalCPUparameters?: string;

        /** Maximum time in s permitted to elapse before a valid connection must be established (WT parameter in connection command) */
        connectionEstablishedTimeout?: number;

        /** Parameters to establish a remote connection */
        remoteParameters?: string;
    };

    /** Settings for installation of project */
    readonly installationSettings?: {
        /** Mode of installation */
        installMode?: "Consistent" | "InstallDuringTaskOperation" | "ForceReboot" | "ForceInitialInstallation";

        /** Installation restrictions */
        installRestriction?: "AllowInitialInstallation" | "AllowPartitioning" | "AllowUpdatesWithoutDataLoss";

        /** Try to keep process variable values */
        keepPVValues?: boolean;

        /** Execute INIT and EXIT subroutines of changed tasks during transfer */
        executeInitExit?: boolean;

        /** Try to boot in RUN mode whenever a reboot of the target is required or forced */
        tryToBootInRUNMode?: boolean;
    };

    /** Command line arguments for PVITransfer.exe */
    readonly pviTransferExecutionArgumets?: string[];
}

//#endregion definitions and types from package.json contribution points

//#region classes

/**
 * Task provider for RUC transfer
 */
class BrAsTransferTaskProvider implements vscode.TaskProvider {
    /**
     * Used to provide standard tasks available in the workspace.
     * Tasks will be executed after selection without calling resolveTask().
     */
    public provideTasks(): vscode.Task[] | undefined {
        const result: vscode.Task[] = [];
        // Ethernet with dialogs for IP address and install settings
        const taskEthernetDialogAll = BrAsTransferTaskProvider.definitionToTask({
            type: transferTaskTypeName,
            asProjectFile: undefined,
            asConfiguration: undefined,
            pviConnectionSettings: {
                deviceInterface: "tcpip",
                sourceNode: 42,
                destinationAddress: undefined,
                destinationPort: 11169,
                communicationTimeout: 1000,
                additionalDeviceParameters: undefined,
                additionalCPUparameters: undefined,
                connectionEstablishedTimeout: 60,
                remoteParameters: undefined,
            },
            installationSettings: {
                installMode: undefined,
                installRestriction: undefined,
                keepPVValues: undefined,
                executeInitExit: undefined,
                tryToBootInRUNMode: undefined,
            },
        });
        taskEthernetDialogAll.name = "Ethernet with dialogs for IP address and install settings";
        result.push(taskEthernetDialogAll);
        // Ethernet with dialog for IP address and default install settings
        const taskEthernetDialogAddr = BrAsTransferTaskProvider.definitionToTask({
            type: transferTaskTypeName,

            asProjectFile: undefined,
            asConfiguration: undefined,
            pviConnectionSettings: {
                deviceInterface: "tcpip",
                sourceNode: 42,
                destinationAddress: undefined,
                destinationPort: 11169,
                communicationTimeout: 1000,
                additionalDeviceParameters: undefined,
                additionalCPUparameters: undefined,
                connectionEstablishedTimeout: 60,
                remoteParameters: undefined,
            },
            installationSettings: {
                installMode: "Consistent",
                installRestriction: "AllowInitialInstallation",
                keepPVValues: false,
                executeInitExit: true,
                tryToBootInRUNMode: false,
            },
        });
        taskEthernetDialogAddr.name = "Ethernet with dialog for IP address and default install settings";
        result.push(taskEthernetDialogAddr);
        // ArSim with default install settings
        const taskArSimDefaultInstall = BrAsTransferTaskProvider.definitionToTask({
            type: transferTaskTypeName,

            asProjectFile: undefined,
            asConfiguration: undefined,
            pviConnectionSettings: {
                deviceInterface: "tcpip",
                sourceNode: 42,
                destinationAddress: "127.0.0.1",
                destinationPort: 11169,
                communicationTimeout: 1000,
                additionalDeviceParameters: undefined,
                additionalCPUparameters: undefined,
                connectionEstablishedTimeout: 60,
                remoteParameters: undefined,
            },
            installationSettings: {
                installMode: "Consistent",
                installRestriction: "AllowInitialInstallation",
                keepPVValues: false,
                executeInitExit: true,
                tryToBootInRUNMode: false,
            },
        });
        taskArSimDefaultInstall.name = "ArSim with default install settings";
        result.push(taskArSimDefaultInstall);
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
        const transferDefinition = BrAsTransferTaskProvider.taskToDefinition(task);
        if (!transferDefinition) {
            return undefined;
        }
        const transferTask = BrAsTransferTaskProvider.definitionToTask(transferDefinition);
        transferTask.definition = task.definition; // resolveTask requires that the original definition object is used. Otherwise a new call to provideTasks is done.
        return transferTask;
    }

    /**
     * Extracts a BrAsTransferTaskDefinition from a task
     * @param task The task containing the definition
     * @returns undefined if task.definition is not a BrAsTransferTaskDefinition
     */
    private static taskToDefinition(task: vscode.Task): BrAsTransferTaskDefinition | undefined {
        if (task.definition.type !== transferTaskTypeName) {
            return undefined;
        }
        const taskDefinition: BrAsTransferTaskDefinition = task.definition as BrAsTransferTaskDefinition;
        return taskDefinition;
    }

    /**
     * Creates a task for RUC transfer by using the task definition values.
     * @param definition The defined values of the task
     */
    private static definitionToTask(definition: BrAsTransferTaskDefinition): vscode.Task {
        // create execution and task
        const name = this.definitionToTaskName(definition);
        const customExec = new vscode.CustomExecution(async () => Promise.resolve(new BrPviTransferTerminal(definition)));
        const task = new vscode.Task(
            definition, // taskDefinition
            vscode.TaskScope.Workspace, // scope
            name, // name
            transferTaskTypeName, // source (type)
            customExec, // execution
            transferTaskProblemMatchers // problemMatchers
        );
        return task;
    }

    /**
     * Generates a task name from a task definition.
     * @param definition Definition for name generation
     */
    private static definitionToTaskName(definition: BrAsTransferTaskDefinition): string {
        const nameContents: string[] = [];
        // connection settings
        //TODO definition.pviConnectionSettings when separate settings are implemented
        // install settings
        Helpers.pushDefined(nameContents, definition.installationSettings?.installMode);
        Helpers.pushDefined(nameContents, definition.installationSettings?.installRestriction);
        if (definition.installationSettings?.keepPVValues) {
            nameContents.push("keep PV val.");
        }
        if (definition.installationSettings?.executeInitExit) {
            nameContents.push("with INIT/EXIT");
        }
        if (definition.installationSettings?.tryToBootInRUNMode) {
            nameContents.push("boot in run");
        }
        // PVITransfer arguments
        if (definition.pviTransferExecutionArgumets) {
            nameContents.push("with PVITransfer arguments");
        }
        // return
        return nameContents.join(" - ");
    }
}

/**
 * A Pseudoterminal which starts PVITransfer.exe on opening
 */
class BrPviTransferTerminal implements vscode.Pseudoterminal {
    private taskDefinition: BrAsTransferTaskDefinition;
    /** Event emitter for write events */
    private writeEmitter = new vscode.EventEmitter<string>();
    /** Event emitter for done signalling */
    private doneEmitter = new vscode.EventEmitter<number | void>();
    /** If set, a child process is active. Kill on user cancellation! */
    private pviTransferProcess?: childProcess.ChildProcessWithoutNullStreams;

    /**
     * Creates a pseudoterminal which starts RUC transfer on opening with the specified task definition.
     * Required but undefined task definition properties will prompt a user dialog for selection.
     * @param taskDefinition The task definition for the execution of RUC transfer.
     */
    constructor(taskDefinition: BrAsTransferTaskDefinition) {
        this.taskDefinition = taskDefinition;
    }

    // The task should wait to do further execution until [Pseudoterminal.open](#Pseudoterminal.open) is called.
    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        void this.executePVITransfer(); //TODO it seems like the handling here for the promise... is not done well
        // TODO clarify async in #55
    }

    // Task cancellation should be handled using [Pseudoterminal.close](#Pseudoterminal.close).
    close(): void {
        if (this.pviTransferProcess) {
            const killed = this.pviTransferProcess.kill();
            if (!killed) {
                logger.warning("Failed to kill PVITransfer.exe");
            }
        }
    }

    // events to invoke for writing to UI and closing terminal
    onDidWrite = this.writeEmitter.event;
    onDidClose = this.doneEmitter.event;

    /**
     * Executes PVITransfer.exe and writes output to the terminal.
     */
    private async executePVITransfer(): Promise<void> {
        this.writeLine("Preparing PVI project transfer task");
        // get undefined values by dialog or setting
        const usedDefinition = await processTaskDefinition(this.taskDefinition);
        if (!usedDefinition) {
            this.writeLine("Dialog cancelled by user or setting not found.");
            this.writeLine("No transfer will be executed.");
            this.done(10);
            return;
        }
        // Get project data
        if (!usedDefinition.asProjectFile) {
            this.writeLine(`ERROR: No project file selected for transfer`);
            this.done(20);
            return;
        }
        const asProject = await WorkspaceProjects.getProjectForUri(vscode.Uri.file(usedDefinition.asProjectFile));
        if (!asProject) {
            this.writeLine(`ERROR: Project ${usedDefinition.asProjectFile} not found`);
            this.done(30);
            return;
        }
        if (!usedDefinition.asConfiguration) {
            this.writeLine(`ERROR: No configuration for transfer selected`);
            this.done(40);
            return;
        }
        const asConfigurationData = asProject.configurations.find((config) => config.name === usedDefinition.asConfiguration);
        if (!asConfigurationData) {
            this.writeLine(`ERROR: Configuration not found in project`);
            this.done(45);
            return;
        }
        // Check if RUC package is existing for selected configuration
        if (asConfigurationData.outPathOffset === undefined) {
            this.writeLine(`ERROR: No CPU package name defined in configuration ${usedDefinition.asConfiguration}.`);
            this.done(55);
            return;
        }
        const rucPackageBaseUri = uriTools.pathJoin(asProject.paths.binaries, asConfigurationData.outPathOffset, "RUCPackage");
        const rucPackageUri = uriTools.pathJoin(rucPackageBaseUri, "RUCPackage.zip");
        if (!(await uriTools.exists(rucPackageUri))) {
            this.writeLine(`ERROR: No RUC package found for configuration ${usedDefinition.asConfiguration}. Please build RUC package first.`);
            this.done(50);
            return;
        }
        // Create PIL file with transfer instructions
        const pilFileUri = uriTools.pathJoin(rucPackageBaseUri, "VSCodeTransfer.pil");
        const pilFileCreated = await createPILFileFromTaskDefinition(usedDefinition, pilFileUri);
        if (!pilFileCreated) {
            this.writeLine(`ERROR: PIL file "${pilFileUri.fsPath}" could not be created`);
            this.done(60);
            return;
        }
        // Get PVITransfer.exe in highest version
        // TODO Maybe start process in PviTransferExe.ts
        const pviTransferExe = (await Environment.pvi.getVersion())?.pviTransfer.exePath;
        if (!pviTransferExe) {
            this.writeLine(`ERROR: No PVI version found`);
            this.done(70);
            return;
        }
        // start transfer process
        this.writeLine("Starting PVI transfer task");
        const transferArgs = taskDefinitionToTransferArgs(usedDefinition, pilFileUri);
        this.writeLine(`${pviTransferExe.fsPath} ${transferArgs.join(" ")}`);
        this.writeLine();
        this.pviTransferProcess = childProcess.spawn(pviTransferExe.fsPath, transferArgs);
        //TODO PVITransfer.exe output is not shown properly. In CMD output is shown, but a bit special. Maybe other spawn / stdio options will help?
        this.pviTransferProcess.stdout.on("data", (data) => this.write(String(data)));
        this.pviTransferProcess.stderr.on("data", (data) => this.write(String(data)));
        this.pviTransferProcess.on("exit", (code) => this.done(code ?? 0));
    }

    /**
     * Writes to the terminal
     * @param text Text to write
     */
    private write(text?: string): void {
        this.writeEmitter.fire(text ?? "");
    }

    /**
     * Writes to the terminal and appends a new line
     * @param text Text to write
     */
    private writeLine(text?: string): void {
        this.write(text);
        this.write("\r\n");
    }

    /**
     * Signals that the terminals execution is done.
     * @param exitCode The exit code of the terminal
     */
    private done(exitCode?: number | void): void {
        this.pviTransferProcess = undefined;
        this.doneEmitter.fire(exitCode);
    }
}

//#endregion classes

//#region local functions

/**
 * Replaces specified values of a BrAsTransferTaskDefinition.
 * All undefined values, also in substructures of withDef will be kept from baseDef.
 * @param baseDef The base definition
 * @param withDef The properties which should be replaced
 */
function taskDefinitionWith(baseDef: BrAsTransferTaskDefinition, withDef: BrAsTransferTaskDefinition): BrAsTransferTaskDefinition {
    // PVI connection settings
    const pviConnWith = withDef.pviConnectionSettings;
    let pviConnResult = baseDef.pviConnectionSettings;
    if (pviConnResult) {
        pviConnResult.deviceInterface = pviConnWith?.deviceInterface ?? pviConnResult.deviceInterface;
        pviConnResult.sourceNode = pviConnWith?.sourceNode ?? pviConnResult.sourceNode;
        pviConnResult.destinationAddress = pviConnWith?.destinationAddress ?? pviConnResult.destinationAddress;
        pviConnResult.destinationPort = pviConnWith?.destinationPort ?? pviConnResult.destinationPort;
        pviConnResult.communicationTimeout = pviConnWith?.communicationTimeout ?? pviConnResult.communicationTimeout;
        pviConnResult.additionalDeviceParameters = pviConnWith?.additionalDeviceParameters ?? pviConnResult.additionalDeviceParameters;
        pviConnResult.additionalCPUparameters = pviConnWith?.additionalCPUparameters ?? pviConnResult.additionalCPUparameters;
        pviConnResult.connectionEstablishedTimeout = pviConnWith?.connectionEstablishedTimeout ?? pviConnResult.connectionEstablishedTimeout;
        pviConnResult.remoteParameters = pviConnWith?.remoteParameters ?? pviConnResult.remoteParameters;
    } else {
        pviConnResult = pviConnWith;
    }
    // Installation settings
    const installWith = withDef.installationSettings;
    let installResult = baseDef.installationSettings;
    if (installResult) {
        installResult.installMode = installWith?.installMode ?? installResult.installMode;
        installResult.installRestriction = installWith?.installRestriction ?? installResult.installRestriction;
        installResult.keepPVValues = installWith?.keepPVValues ?? installResult.keepPVValues;
        installResult.executeInitExit = installWith?.executeInitExit ?? installResult.executeInitExit;
        installResult.tryToBootInRUNMode = installWith?.tryToBootInRUNMode ?? installResult.tryToBootInRUNMode;
    } else {
        installResult = installWith;
    }
    // Final result
    return {
        type: withDef.type ?? baseDef.type,
        asProjectFile: withDef.asProjectFile ?? baseDef.asProjectFile,
        asConfiguration: withDef.asConfiguration ?? baseDef.asConfiguration,
        pviConnectionSettings: pviConnResult,
        installationSettings: installResult,
        pviTransferExecutionArgumets: withDef.pviTransferExecutionArgumets ?? baseDef.pviTransferExecutionArgumets,
    };
}

/**
 * Processes a raw task definition by searching and replacing empty values or special literals within the baseDefinition.
 * @param baseDefinition The base definition which is extended.
 * @returns A new BrAsBuildTaskDefinition with additional and modified properties, or undefined if processing failed.
 */
async function processTaskDefinition(baseDefinition: BrAsTransferTaskDefinition): Promise<BrAsTransferTaskDefinition | undefined> {
    //TODO add evaluation of VS Code variables. e.g. "asProjectFile": "${workspaceFolder}/AsTestPrj.apj
    const withSettings = processTaskDefinitionWithSettings(baseDefinition);
    if (!withSettings) {
        return undefined;
    }
    const withDialogs = await processTaskDefinitionWithDialogs(withSettings);
    if (!withDialogs) {
        return undefined;
    }
    const withDefaults = processTaskDefinitionWithDefaults(withDialogs);
    return withDefaults;
}

/**
 * Fills properties which are set BrAsBuildLiterals.UseSettings by getting the corresponding setting value.
 * @param baseDefinition The base definition which is extended.
 * @returns A new BrAsBuildTaskDefinition with properties from settings, or undefined if a setting was not found.
 */
function processTaskDefinitionWithSettings(baseDefinition: BrAsTransferTaskDefinition): BrAsTransferTaskDefinition | undefined {
    // // build mode
    // let asBuildMode = baseDefinition.asBuildMode;
    // if (asBuildMode === BrAsTransferLiterals.UseSettings) {
    //     asBuildMode = BrConfiguration.getDefaultBuildMode();
    //     if (!asBuildMode) {
    //         return undefined;
    //     }
    // }
    // // apply setting values
    // return taskDefinitionWith(baseDefinition,
    //     {
    //         type:        baseDefinition.type,
    //         asBuildMode: asBuildMode
    //     });
    // no settings defined
    return baseDefinition;
}

/**
 * Fills undefined properties of a task definition by prompting dialogs to the user.
 * @param baseDefinition The base definition which is extended.
 * @returns A new BrAsBuildTaskDefinition with additional properties from dialogs, or undefined if a dialog was cancelled.
 */
async function processTaskDefinitionWithDialogs(baseDefinition: BrAsTransferTaskDefinition): Promise<BrAsTransferTaskDefinition | undefined> {
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
    // PVI connection settings
    let pviDestinationAddress = baseDefinition.pviConnectionSettings?.destinationAddress;
    if (!pviDestinationAddress) {
        pviDestinationAddress = await vscode.window.showInputBox({ prompt: "IP Address or host name of target" });
    }
    // Installation settings
    let installMode = baseDefinition.installationSettings?.installMode;
    if (!installMode) {
        //TODO centralize pakage.json Enums, dialogs...
        installMode = await Dialogs.getQuickPickSingleValue(
            [
                { value: "Consistent", label: "All tasks will be paused during installation" },
                { value: "InstallDuringTaskOperation", label: "Only changed tasks will be paused during installation" },
                { value: "ForceReboot", label: "PLC will be rebooted and the installation is done during booting" },
                { value: "ForceInitialInstallation", label: "Initial installation which resets all data" },
            ],
            { title: "Installation restrictions" }
        );
    }
    let installRestriction = baseDefinition.installationSettings?.installRestriction;
    if (!installRestriction) {
        installRestriction = await Dialogs.getQuickPickSingleValue(
            [
                { value: "AllowInitialInstallation", label: "Allow initial installation" },
                { value: "AllowPartitioning", label: "Allow partitioning" },
                { value: "AllowUpdatesWithoutDataLoss", label: "Allow only updates without data loss" },
            ],
            { title: "Installation restrictions" }
        );
    }
    let keepPVValues = baseDefinition.installationSettings?.keepPVValues;
    if (keepPVValues === undefined) {
        keepPVValues = await Dialogs.yesNoDialog("Keep PV values?");
    }
    let executeInitExit = baseDefinition.installationSettings?.executeInitExit;
    if (executeInitExit === undefined) {
        executeInitExit = await Dialogs.yesNoDialog("Execute EXIT and INIT routines?");
    }
    let tryToBootInRUNMode = baseDefinition.installationSettings?.tryToBootInRUNMode;
    if (tryToBootInRUNMode === undefined) {
        tryToBootInRUNMode = await Dialogs.yesNoDialog("Try to boot in RUN mode if a restart is required of forced?");
    }
    // apply dialog values
    return taskDefinitionWith(baseDefinition, {
        type: baseDefinition.type,
        asProjectFile: asProjectFile,
        asConfiguration: asConfiguration,
        pviConnectionSettings: {
            destinationAddress: pviDestinationAddress,
        },
        installationSettings: {
            installMode: installMode,
            installRestriction: installRestriction,
            keepPVValues: keepPVValues,
            executeInitExit: executeInitExit,
            tryToBootInRUNMode: tryToBootInRUNMode,
        },
    });
}

/**
 *
 * @param baseDefinition
 */
function processTaskDefinitionWithDefaults(baseDefinition: BrAsTransferTaskDefinition): BrAsTransferTaskDefinition | undefined {
    // PVI connection settings

    // Installation settings

    // apply default values
    return taskDefinitionWith(baseDefinition, {
        type: baseDefinition.type,
    });
}

/**
 * Creates the arguments required for PVITransfer.exe based on a task definition and the PIL file to call.
 */
function taskDefinitionToTransferArgs(definition: BrAsTransferTaskDefinition, pilFile: vscode.Uri): string[] {
    const transferArgs: string[] = [];
    // PVITransfer.exe call arguments
    if (definition.pviTransferExecutionArgumets) {
        transferArgs.push(...definition.pviTransferExecutionArgumets);
    } else {
        transferArgs.push("-automatic", "-consoleOutput");
    }
    // PIL file
    transferArgs.push(`-${pilFile.fsPath}`);
    return transferArgs;
}

/**
 * Creates a PIL file for transfering the project from a task definiton.
 * @param definition The task definition to create the PIL file from
 */
async function createPILFileFromTaskDefinition(definition: BrAsTransferTaskDefinition, pilFile: vscode.Uri): Promise<boolean> {
    // connection command, device parameters
    const connDeviceParArgs: string[] = [];
    if (definition.pviConnectionSettings?.deviceInterface) {
        connDeviceParArgs.push(`/IF=${definition.pviConnectionSettings.deviceInterface}`);
    }
    if (definition.pviConnectionSettings?.sourceNode) {
        connDeviceParArgs.push(`/SA=${definition.pviConnectionSettings.sourceNode}`);
    }
    if (definition.pviConnectionSettings?.additionalDeviceParameters) {
        connDeviceParArgs.push(definition.pviConnectionSettings.additionalDeviceParameters);
    }
    const connDevicePar = connDeviceParArgs.join(" ");
    // connection command, CPU parameters
    const connCpuParArgs: string[] = [];
    if (definition.pviConnectionSettings?.destinationAddress) {
        connCpuParArgs.push(`/IP=${definition.pviConnectionSettings.destinationAddress}`);
    }
    if (definition.pviConnectionSettings?.destinationPort) {
        connCpuParArgs.push(`/PT=${definition.pviConnectionSettings.destinationPort}`);
    }
    if (definition.pviConnectionSettings?.communicationTimeout) {
        connCpuParArgs.push(`/COMT=${definition.pviConnectionSettings.communicationTimeout}`);
    }
    if (definition.pviConnectionSettings?.additionalCPUparameters) {
        connCpuParArgs.push(definition.pviConnectionSettings.additionalCPUparameters);
    }
    const connCpuPar = connCpuParArgs.join(" ");
    // connection command, waiting time
    let connWaitingTime = "";
    if (definition.pviConnectionSettings?.connectionEstablishedTimeout) {
        connWaitingTime = `WT=${definition.pviConnectionSettings.communicationTimeout}`;
    }
    // connection command, concatenate
    const connCommandArgs: string[] = [];
    connCommandArgs.push(`Connection`);
    connCommandArgs.push(` "${connDevicePar}"`);
    connCommandArgs.push(`, "${connCpuPar}"`);
    connCommandArgs.push(`, "${connWaitingTime}"`);
    if (definition.pviConnectionSettings?.remoteParameters) {
        connCommandArgs.push(`, "${definition.pviConnectionSettings.remoteParameters}"`);
    }
    const connCommand = connCommandArgs.join("");
    // transfer command
    const transferRUCFile = "RUCPackage.zip";
    const transferInstallSettings = [
        //TODO do not set default values here!
        `InstallMode=${definition.installationSettings?.installMode ?? "Consistent"}`,
        `InstallRestriction=${definition.installationSettings?.installRestriction ?? "AllowUpdatesWithoutDataLoss"}`,
        `KeepPVValues=${definition.installationSettings?.keepPVValues ? "1" : "0"}`,
        `ExecuteInitExit=${definition.installationSettings?.executeInitExit ? "1" : "0"}`,
        `TryToBootInRUNMode=${definition.installationSettings?.tryToBootInRUNMode ? "1" : "0"}`,
    ].join(" ");
    const transferCommand = `Transfer "${transferRUCFile}", "${transferInstallSettings}"`;
    // create file
    const created = await fileTools.createFile(pilFile, { overwrite: true });
    if (!created) {
        return false;
    }
    // write file
    const pilFileContents = [
        connCommand,
        transferCommand,
        "", // new line at end of file
    ].join("\r\n");
    return fileTools.insertTextAtBeginOfFile(pilFile, pilFileContents);
}

//#endregion local functions
