/* eslint-disable @typescript-eslint/require-await */
/**
 * Tests for APIs by invoking a test command
 * @packageDocumentation
 */

import * as semver from "semver";
import * as vscode from "vscode";
import { SystemGeneration, TargetArchitecture } from "../Environment/CommonTypes";
import { Environment } from "../Environment/Environment";
import { GccInstallation } from "../Environment/GccInstallation";
import { getPlcProperties } from "../Environment/PlcLookup";
import { extensionConfiguration } from "../ExtensionConfiguration";
import * as Dialogs from "../UI/Dialogs";
import { statusBar } from "../UI/StatusBar";
import { AsProjectConfiguration } from "../Workspace/AsProjectConfiguration";
import { WorkspaceProjects } from "../Workspace/BRAsProjectWorkspace";
import { AsPackageFile } from "../Workspace/Files/AsPackageFile";
import { AsProjectFile } from "../Workspace/Files/AsProjectFile";
import { AsXmlFile } from "../Workspace/Files/AsXmlFile";
import { ConfigPackageFile } from "../Workspace/Files/ConfigPackageFile";
import { CpuPackageFile } from "../Workspace/Files/CpuPackageFile";
import { UserSettingsFile } from "../Workspace/Files/UserSettingsFile";
import * as fileTools from "./FileTools";
import * as Helpers from "./Helpers";
import { logger } from "./Logger";
import * as uriTools from "./UriTools";

/**
 * Register test functionality
 * @param context The extension context
 */
export function registerApiTests(context: vscode.ExtensionContext): void {
    // Command: Test
    const disposable = vscode.commands.registerCommand("vscode-brautomationtools.test", (arg1, arg2) => testCommand(arg1, arg2, context));
    context.subscriptions.push(disposable);
}

async function testCommand(arg1: unknown, arg2: unknown, context: vscode.ExtensionContext): Promise<void> {
    logger.showOutput();
    logHeader("Test command start");
    // select tests to execute
    if ((await Dialogs.yesNoDialog("Run tests for temporary stuff?")) === true) {
        await testTemp(context);
    }
    if ((await Dialogs.yesNoDialog("Run various tests?")) === true) {
        await testVarious(arg1, arg2);
    }
    if ((await Dialogs.yesNoDialog("Run tests for UriTools?")) === true) {
        await testUriTools();
    }
    if ((await Dialogs.yesNoDialog("Run tests for FileTools?")) === true) {
        await testFileTools();
    }
    if ((await Dialogs.yesNoDialog("Run tests for Helpers?")) === true) {
        await testHelpers();
    }
    if ((await Dialogs.yesNoDialog("Run tests for file system events?")) === true) {
        await testFileSystemEvents();
    }
    if ((await Dialogs.yesNoDialog("Run tests for AutomationStudioVersion?")) === true) {
        await testAutomationStudioVersion(context);
    }
    if ((await Dialogs.yesNoDialog("Run tests for gcc?")) === true) {
        await testGcc(context);
    }
    if ((await Dialogs.yesNoDialog("Run tests for PVI?")) === true) {
        await testPvi(context);
    }
    if ((await Dialogs.yesNoDialog("Run tests for BRConfiguration?")) === true) {
        await testBRConfiguration();
    }
    if ((await Dialogs.yesNoDialog("Run tests for workspace projects?")) === true) {
        await testWorkspaceProjects();
    }
    if ((await Dialogs.yesNoDialog("Run tests for BRAsProjectWorkspace?")) === true) {
        await testBRAsProjectWorkspace();
    }
    if ((await Dialogs.yesNoDialog("Run tests for workspace project files?")) === true) {
        await testProjectFiles();
    }
    if ((await Dialogs.yesNoDialog("Run tests for workspace project files with manual selection?")) === true) {
        await testProjectFilesManualSel();
    }
    if ((await Dialogs.yesNoDialog("Run tests for VS Code extension context?")) === true) {
        await testVsCodeExtensionContext(context);
    }
    if ((await Dialogs.yesNoDialog("Run tests for BrLog")) === true) {
        await testBrLog(context);
    }
    if ((await Dialogs.yesNoDialog("Run tests for StatusBar")) === true) {
        await testStatusBar(context);
    }
    if ((await Dialogs.yesNoDialog("Run tests for PLC lookup table")) === true) {
        await testPlcLookup(context);
    }
    // end
    logHeader("Test command end");
}

async function testTemp(context: vscode.ExtensionContext): Promise<void> {
    logHeader("Test temporary stuff start");
    logHeader("Test temporary stuff end");
}

async function testVarious(arg1: unknown, arg2: unknown): Promise<void> {
    logHeader("Test various start");
    // check command arguments
    logger.info("arg1 and arg2:", { arg1: arg1, arg2: arg2 });
    // end
    logHeader("Test various end");
}

async function testFileSystemEvents(): Promise<void> {
    logHeader("Test file system events start");
    /**
     * #### Test FileSystemWatcher:
     * - All events are registered, also events triggered by outside programs
     * - Rename is registered as create -> delete
     * - Rename / adding / deleting of files is also registered by the containing directory
     * - No details of the event are available, only the URI -> hard to distinguish a rename from a create / delete
     * - Patterns can be set to only register some files / events
     * #### Conclusion:
     * - Will be useful to watch changes to specific file contents (onDidChange)
     * - e.g. change of active configuration
     */
    const pattern = "**";
    logger.info("createFileSystemWatcher:", { pattern: pattern });
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange((uri) => {
        logger.info("File changed:", { uri: uri.toString(true) });
    });
    watcher.onDidCreate((uri) => {
        logger.info("File created:", { uri: uri.toString(true) });
    });
    watcher.onDidDelete((uri) => {
        logger.info("File deleted:", { uri: uri.toString(true) });
    });
    /**
     * #### Test vscode.workspace.onDidXxxxFiles:
     * - Only events triggered by the user within VS Code are registered
     * - vscode.workspace.fs API events do not trigger this event
     * - No patterns can be set to filter the results -> needs own implementation
     * - Information of old / new data available
     * - Moving files is registered as a rename
     * #### Conclusion:
     * - Will be useful to watch moving / deleting / creating files in the general AS workspace
     * - Can be used e.g. for a feature to automatically adjust package files
     */
    vscode.workspace.onDidRenameFiles((event) => {
        const fromTo = event.files.map((f) => `${f.oldUri.toString(true)} -> ${f.newUri.toString(true)}`);
        logger.info("Files renamed from -> to:", { fromTo: fromTo });
    });
    logHeader("Test file system events end");
}

async function testUriTools(): Promise<void> {
    logHeader("Test UriTools start");
    const uriFrom = vscode.Uri.file("C:\\Temp\\");
    const uriToIsSub = vscode.Uri.file("c:\\Temp\\Test1\\test.txt");
    const uriToNotSub = vscode.Uri.file("C:\\User\\Test1\\test.txt");
    // test pathRelative
    logger.info("uriTools.pathRelative(from, to)", {
        from: uriFrom.path,
        to: uriToIsSub.path,
        result: uriTools.pathRelative(uriFrom, uriToIsSub),
    });
    logger.info("uriTools.pathRelative(from, to)", {
        from: uriFrom.path,
        to: uriToNotSub.path,
        result: uriTools.pathRelative(uriFrom, uriToNotSub),
    });
    // test isSubOf
    logger.info("uriTools.isSubOf(base, uri)", {
        base: uriFrom.path,
        uri: uriToIsSub.path,
        result: uriTools.isSubOf(uriFrom, uriToIsSub),
    });
    logger.info("uriTools.isSubOf(base, uri)", {
        base: uriFrom.path,
        uri: uriToNotSub.path,
        result: uriTools.isSubOf(uriFrom, uriToNotSub),
    });
    // test pathsFromTo
    logger.info("uriTools.pathsFromTo(from, to)", {
        from: uriFrom.path,
        to: uriToIsSub.path,
        result: uriTools.pathsFromTo(uriFrom, uriToIsSub),
    });
    logger.info("uriTools.pathsFromTo(from, to)", {
        from: uriFrom.path,
        to: uriToNotSub.path,
        result: uriTools.pathsFromTo(uriFrom, uriToNotSub),
    });
    logger.info("uriTools.pathsFromTo(from, to)", {
        from: uriFrom.path,
        to: uriFrom.path,
        result: uriTools.pathsFromTo(uriFrom, uriFrom),
    });
    // test pathsFromTo with replace
    const uriReplace = vscode.Uri.file("C:\\Replace\\");
    logger.info("uriTools.pathsFromTo(from, to, replace)", {
        from: uriFrom.path,
        to: uriToIsSub.path,
        replace: uriReplace.path,
        result: uriTools.pathsFromTo(uriFrom, uriToIsSub, uriReplace),
    });
    logger.info("uriTools.pathsFromTo(from, to, replace)", {
        from: uriFrom.path,
        to: uriToNotSub.path,
        replace: uriReplace.path,
        result: uriTools.pathsFromTo(uriFrom, uriToNotSub, uriReplace),
    });
    logger.info("uriTools.pathsFromTo(from, to, replace)", {
        from: uriFrom.path,
        to: uriFrom.path,
        replace: uriReplace.path,
        result: uriTools.pathsFromTo(uriFrom, uriFrom, uriReplace),
    });
    // end
    logHeader("Test UriTools end");
}

async function testFileTools(): Promise<void> {
    logHeader("Test FileTools start");
    if (!vscode.workspace.workspaceFolders) {
        logger.info("No workspace folder defined");
        return;
    }
    const wsUri = vscode.workspace.workspaceFolders[0].uri;
    const fileUri = uriTools.pathJoin(wsUri, "MyTempFile.txt");
    logger.info(`Creating file ${logger.formatUri(fileUri)}`);
    await fileTools.createFile(fileUri, { overwrite: true });
    logger.info(`Insert text into file ${logger.formatUri(fileUri)}`);
    await fileTools.insertTextInFile(fileUri, new vscode.Position(0, 0), "asdf");
    // end
    logHeader("Test FileTools end");
}

async function testHelpers(): Promise<void> {
    logHeader("Test Helpers start");
    // test pushDefined
    const mixedValues = [true, false, undefined, null];
    const result: boolean[] = [];
    Helpers.pushDefined(result, ...mixedValues);
    Helpers.pushDefined(result, undefined);
    Helpers.pushDefined(result, null);
    Helpers.pushDefined(result, true);
    Helpers.pushDefined(result, false);
    logger.info("Helpers.pushDefined()", { result: result });
    // end
    logHeader("Test Helpers end");
}

async function testAutomationStudioVersion(context: vscode.ExtensionContext): Promise<void> {
    logHeader("Test AutomationStudioVersion start");
    // Update AS versions
    const update = await Dialogs.yesNoDialog("Update AS versions?");
    if (update === true) {
        const allVersions = await Environment.automationStudio.updateVersions();
        logger.info("AS versions found:", { versions: allVersions });
    }
    // Test queries for specific AS versions
    const highestAs = await Environment.automationStudio.getVersion();
    logger.info("highest AS", { as: highestAs });
    const asV48 = await Environment.automationStudio.getVersion("4.8");
    logger.info("AS V4.8 not strict", { as: asV48 });
    const asV48Strict = await Environment.automationStudio.getVersion("4.8", true);
    logger.info("AS V4.8 strict", { as: asV48Strict });
    const asV46 = await Environment.automationStudio.getVersion("4.6");
    logger.info("AS V4.6 not strict", { as: asV46 });
    const asV46Strict = await Environment.automationStudio.getVersion("4.6", true);
    logger.info("AS V4.6 strict", { as: asV46Strict });
    logHeader("Test AutomationStudioVersion end");
}

async function testGcc(context: vscode.ExtensionContext): Promise<void> {
    logHeader("Test gcc start");
    // get gcc versions for AS V4.10
    const gccBase = vscode.Uri.file("C:\\BrAutomation\\AS410\\AS\\gnuinst");
    const gccInstall = await GccInstallation.searchAutomationStudioGnuinst(gccBase);
    logger.info("Gcc versions", {
        base: gccBase.fsPath,
        gccInstall: gccInstall,
    });
    // Get targets
    do {
        const gccVersionStr = await vscode.window.showInputBox({ title: "Enter gcc version" });
        const gccVersion = semver.coerce(gccVersionStr) ?? undefined;
        const sysGen = await Dialogs.getQuickPickSingleValue<SystemGeneration>(
            [
                { value: "SGC", label: "SGC" },
                { value: "SG3", label: "SG3" },
                { value: "SG4", label: "SG4" },
                { value: "UNKNOWN", label: "UNKNOWN" },
            ],
            { title: "Select SG" }
        );
        const arch = await Dialogs.getQuickPickSingleValue<TargetArchitecture>(
            [
                { value: "M68K", label: "M68K" },
                { value: "IA32", label: "IA32" },
                { value: "Arm", label: "Arm" },
                { value: "UNKNOWN", label: "UNKNOWN" },
            ],
            { title: "Select architecture" }
        );
        const strict = await Dialogs.yesNoDialog("Strict search?");
        const matchingExe = gccInstall.getExecutable(gccVersion, sysGen, arch, strict);
        logger.info("Matching gcc exe:", { result: matchingExe });
    } while ((await Dialogs.yesNoDialog("Try again?")) === true);
    // Test mingw gcc
    const mingwBase = vscode.Uri.file("C:\\msys64\\mingw64");
    const mingwGcc = await GccInstallation.createFromDir(mingwBase);
    logger.info("mingw64 gcc", { gcc: mingwGcc }); //TODO Gives 64.0.0...
    logHeader("Test gcc end");
}

async function testPvi(context: vscode.ExtensionContext): Promise<void> {
    logHeader("Test PVI start");
    // Update PVI
    const update = await Dialogs.yesNoDialog("Update PVI versions?");
    if (update === true) {
        const allVersions = await Environment.pvi.updateVersions();
        logger.info("PVI versions found:", { versions: allVersions });
    }
    // Test queries for specific PVI versions
    const highestPvi = await Environment.pvi.getVersion();
    logger.info("highest PVI", { pvi: highestPvi });
    const pviV48 = await Environment.pvi.getVersion("4.8");
    logger.info("PVI V4.8 not strict", { pvi: pviV48 });
    const pviV48Strict = await Environment.pvi.getVersion("4.8", true);
    logger.info("PVI V4.8 strict", { pvi: pviV48Strict });
    const pviV46 = await Environment.pvi.getVersion("4.6");
    logger.info("PVI V4.6 not strict", { pvi: pviV46 });
    const pviV46Strict = await Environment.pvi.getVersion("4.6", true);
    logger.info("PVI V4.6 strict", { pvi: pviV46Strict });
    logHeader("Test PVI end");
}

async function testBRConfiguration(): Promise<void> {
    logHeader("Test BRConfiguration start");
    logger.info("Get configuration values", {
        build: {
            defaultBuildMode: extensionConfiguration.build.defaultBuildMode,
        },
        environment: {
            automationStudioInstallPaths: extensionConfiguration.environment.automationStudioInstallPaths,
            pviInstallPaths: extensionConfiguration.environment.pviInstallPaths,
        },
        logging: {
            logLevel: extensionConfiguration.logging.logLevel,
            prettyPrintAdditionalData: extensionConfiguration.logging.prettyPrintAdditionalData,
        },
        notifications: {
            hideActivationMessage: extensionConfiguration.notifications.hideActivationMessage,
            hideNewVersionMessage: extensionConfiguration.notifications.hideNewVersionMessage,
        },
    });
    // end
    logHeader("Test BRConfiguration end");
}

async function testWorkspaceProjects(): Promise<void> {
    logHeader("Test workspace projects start");
    // Get project for directories...
    const projects = await WorkspaceProjects.getProjects();
    const project = projects.pop();
    if (project === undefined) {
        logger.info("No projects found for tests");
        return;
    }
    // Configuration test
    const configRootPaths = project.configurations.map((config) => config.rootPath);
    for (const configRootPath of configRootPaths) {
        const config = await AsProjectConfiguration.createFromDir(configRootPath, project.paths.projectRoot);
        logger.info("AsProjectConfiguration.createFromDir(uri)", { uri: configRootPath.toString(true), result: config });
    }
    // Update AS projects
    // if (await Dialogs.yesNoDialog('Update AS projects in workspace?')) {
    // 	logger.info('BRAsProjectWorkspace.updateWorkspaceProjects() start');
    // 	const numProjects = await BRAsProjectWorkspace.updateWorkspaceProjects();
    // 	logger.info('BRAsProjectWorkspace.updateWorkspaceProjects() done', { result: numProjects });
    // }
    // Get AS projects info
    // const projectsData = await BRAsProjectWorkspace.getWorkspaceProjects();
    // logger.info('BRAsProjectWorkspace.getWorkspaceProjects()', { result: projectsData });
    // find project for path
    // const pathToGetProject = await vscode.window.showInputBox({ prompt: 'Enter path to get corresponding project' });
    // if (pathToGetProject) {
    // 	const uri = vscode.Uri.file(pathToGetProject);
    // 	const projectForPath = await BRAsProjectWorkspace.getProjectForUri(uri);
    // 	logger.info('BRAsProjectWorkspace.getProjectForUri(uri)', { uri: uri.toString(true), result: projectForPath });
    // }
    // Get header directories
    // const pathToGetHeaderDirs = await vscode.window.showInputBox({ prompt: 'Enter path to get corresponding header directories' });
    // if (pathToGetHeaderDirs) {
    // 	const uri = vscode.Uri.file(pathToGetHeaderDirs);
    // 	const headerDirsForPath = await BRAsProjectWorkspace.getProjectHeaderIncludeDirs(uri);
    // 	logger.info('BRAsProjectWorkspace.getProjectHeaderIncludeDirs(uri)', { uri: uri.toString(true), result: headerDirsForPath });
    // }
    // end
    logHeader("Test workspace projects end");
}

async function testBRAsProjectWorkspace(): Promise<void> {
    //TODO, old, remove
    logHeader("Test WorkspaceProjects start");
    // Update AS projects
    if ((await Dialogs.yesNoDialog("Update AS projects in workspace?")) === true) {
        logger.info("WorkspaceProjects.updateProjects() start");
        const numProjects = await WorkspaceProjects.updateProjects();
        logger.info("WorkspaceProjects.updateProjects() done", { result: numProjects });
    }
    // Get AS projects info
    const projectsData = await WorkspaceProjects.getProjects();
    logger.info("WorkspaceProjects.getProjects()", { result: projectsData });
    // find project for path
    const pathToGetProject = await vscode.window.showInputBox({ prompt: "Enter path to get corresponding project" });
    if (pathToGetProject !== undefined && pathToGetProject !== "") {
        const uri = vscode.Uri.file(pathToGetProject);
        const projectForPath = await WorkspaceProjects.getProjectForUri(uri);
        logger.info("WorkspaceProjects.getProjectForUri(uri)", { uri: uri.toString(true), result: projectForPath });
    }
    // Get build settings for file / URI
    const pathToGetHeaderDirs = await vscode.window.showInputBox({ prompt: "Enter path to get corresponding header directories" });
    if (pathToGetHeaderDirs !== undefined && pathToGetHeaderDirs !== "") {
        const uri = vscode.Uri.file(pathToGetHeaderDirs);
        const buildInfo = await WorkspaceProjects.getCBuildInformationForUri(uri);
        logger.info("WorkspaceProjects.getCBuildInformationForUri(uri)", { uri: uri.toString(true), result: buildInfo });
    }

    //TODO add library in test project
    /*
	const wsFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined;
	if (!wsFolder) {
		console.error('No workspace folder found');
		return;
	}
	// test getProjectUriType
	console.log('BRAsProjectWorkspace.getProjectUriType');
	const uris: vscode.Uri[] = [
		// project base folders and files
		uriTools.pathJoin(wsFolder, ''),
		uriTools.pathJoin(wsFolder, 'AsTestPrj.apj'),
		uriTools.pathJoin(wsFolder, 'Logical'),
		uriTools.pathJoin(wsFolder, 'Physical'),
		uriTools.pathJoin(wsFolder, 'Binaries'),
		uriTools.pathJoin(wsFolder, 'Temp'),
		// programs and program source files
		uriTools.pathJoin(wsFolder, 'Logical/Package.pkg'),
		uriTools.pathJoin(wsFolder, 'Logical/Global.typ'),
		uriTools.pathJoin(wsFolder, 'Logical/Global.var'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/Package.pkg'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/NoErrNoWrnConst.var'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/NoErrNoWrnEnum.typ'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/NoErrNoWrnStruct.typ'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/NoErrNoWrnVar.var'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgMulti'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgMulti/ANSIC.prg'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgMulti/Cyclic.c'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgMulti/Types.typ'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgMulti/Variables.var'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgMulti/InitExit'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgMulti/InitExit/Package.pkg'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgMulti/InitExit/Exit.c'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgMulti/InitExit/Init.c'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgSingle'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgSingle/ANSIC.prg'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgSingle/Main.c'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgSingle/Types.typ'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/CPrgSingle/Variables.var'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/STPrgMuti'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/STPrgMuti/IEC.prg'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/STPrgMuti/Cyclic.st'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/STPrgMuti/Exit.st'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/STPrgMuti/Init.st'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/STPrgMuti/Types.typ'),
		uriTools.pathJoin(wsFolder, 'Logical/NoErrNoWrn/STPrgMuti/Variables.var')
	];
	const urisWithTypes: {uri: vscode.Uri, type: BRAsProjectWorkspace.ProjectUriType}[] = [];
	for (const uri of uris) {
		const type = await BRAsProjectWorkspace.getProjectUriType(uri);
		urisWithTypes.push({
			uri: uri,
			type: type
		});
	}
	console.log(urisWithTypes);
	*/
    // end
    logHeader("Test WorkspaceProjects end");
}

async function testProjectFiles(): Promise<void> {
    logHeader("Test project files start");
    // get AS project for further tests
    const asProjects = await WorkspaceProjects.getProjects();
    if (asProjects.length === 0) {
        return;
    }
    const asProject = asProjects[0];
    // test *.apj info
    const projectFilePath = asProject.paths.projectFile;
    const projectFile = await AsProjectFile.createFromFile(projectFilePath);
    logger.info("AsProjectFile.createFromPath(uri)", { uri: projectFilePath.toString(true), result: projectFile });
    // test Physical.pkg
    const physicalPkgPath = uriTools.pathJoin(asProject.paths.physical, "Physical.pkg");
    const physicalPkg = await AsPackageFile.createFromFile(physicalPkgPath);
    logger.info("AsPackageFile.createFromPath(uri)", { uri: physicalPkgPath.toString(true), result: physicalPkg });
    logger.info("Resolve child object paths for package uri", {
        filePath: physicalPkg?.filePath.toString(true),
        children: physicalPkg?.childObjects.map((child) => child.resolvePath(asProject.paths.projectRoot).toString(true)),
    });
    // test Config.pkg
    const configPkgPaths = await vscode.workspace.findFiles({ base: asProject.paths.physical.fsPath, pattern: "*/Config.pkg" });
    for (const configPkgPath of configPkgPaths) {
        const configPkg = await ConfigPackageFile.createFromFile(configPkgPath);
        logger.info("ConfigPackageFile.createFromPath(uri)", { uri: configPkgPath.toString(true), result: configPkg });
        logger.info("Resolve child object paths for package uri", {
            filePath: configPkg?.filePath.toString(true),
            children: configPkg?.childObjects.map((child) => child.resolvePath(asProject.paths.projectRoot).toString(true)),
        });
    }
    // test Cpu.pkg
    const cpuPkgPaths = await vscode.workspace.findFiles({ base: asProject.paths.physical.fsPath, pattern: "*/*/Cpu.pkg" });
    for (const cpuPkgPath of cpuPkgPaths) {
        const cpuPkg = await CpuPackageFile.createFromFile(cpuPkgPath);
        logger.info("CpuPackageFile.createFromPath(uri)", { uri: cpuPkgPath.toString(true), result: cpuPkg });
        logger.info("Resolve child object paths for package uri", {
            filePath: cpuPkg?.filePath.toString(true),
            children: cpuPkg?.childObjects.map((child) => child.resolvePath(asProject.paths.projectRoot).toString(true)),
        });
        logger.info("Resolve include dirs for package uri", {
            filePath: cpuPkg?.filePath.toString(true),
            includes: cpuPkg?.cpuConfig.build.resolveAnsiCIncludeDirs(asProject.paths.projectRoot).map((uri) => uri.toString(true)),
        });
    }
    // test *.set info
    const settingFiles = await vscode.workspace.findFiles({ base: asProject.paths.projectRoot.fsPath, pattern: "*.set" });
    for (const file of settingFiles) {
        const result = await UserSettingsFile.createFromFile(file);
        logger.info("UserSettingsFile.createFromPath(uri)", { uri: file.toString(true), result: result });
    }
    //end
    logHeader("Test project files end");
}

async function testProjectFilesManualSel(): Promise<void> {
    logHeader("Test project files start");
    // select a file for further tests
    const filePath = await selectFile();
    if (filePath === undefined) {
        return;
    }
    const fileContent = (await vscode.workspace.openTextDocument(filePath)).getText();
    // test base XML file
    const xmlFile = await AsXmlFile.createFromFile(filePath);
    logger.info("AsXmlFileNew.createFromFile(uri)", {
        uri: filePath.toString(true),
        result: xmlFile,
        resultEqualToSource: xmlFile?.toXml() === fileContent,
    });
    // Write XML file to disk
    const newFileName = await vscode.window.showInputBox({ prompt: "Enter new file name to save XML, empty or ESC to abort" });
    if (newFileName !== undefined && newFileName !== "" && xmlFile !== undefined) {
        const xmlDir = uriTools.pathDirname(filePath);
        const newFilePath = uriTools.pathJoin(xmlDir, newFileName);
        //xmlFile.versionHeader = { asVersion: "6.3.5.44 UP" };
        const success = await xmlFile.writeToFile(newFilePath);
        logger.info(`Tried to write file ${logger.formatUri(newFilePath)}`, { success: success });
    }
    // Test project file
    const prjFile = await AsProjectFile.createFromFile(filePath);
    logger.info("AsProjectFile.createFromFile(uri)", {
        uri: filePath.toString(true),
        result: prjFile,
        resultEqualToSource: prjFile?.toXml() === fileContent,
    });
    // Test package file
    const pkgFile = await AsPackageFile.createFromFile(filePath);
    logger.info("AsPackageFile.createFromFile(uri)", {
        uri: filePath.toString(true),
        result: pkgFile,
        resultEqualToSource: pkgFile?.toXml() === fileContent,
    });
    await pkgFile?.updateChildren(true);
    logger.info("AsPackageFile.updateChildren(true)", {
        uri: filePath.toString(true),
        result: pkgFile,
        resultEqualToSource: pkgFile?.toXml() === fileContent,
    });
    //end
    logHeader("Test project files end");
}

async function testVsCodeExtensionContext(context: vscode.ExtensionContext): Promise<void> {
    //TODO can be used for generated files, user query flags...
    // see https://code.visualstudio.com/api/extension-capabilities/common-capabilities#data-storage
    logHeader("Test VsCodeExtensionContext start");
    // Storage for temporary files, e.g. generated headers, PIL files...
    logger.info("vscode.ExtensionContext values", {
        extensionPath: context.extensionPath,
        extensionUri: context.extensionUri.toString(true),
        extensionMode: context.extensionMode,
        globalStorageUri: context.globalStorageUri.toString(true),
        storageUri: context.storageUri?.toString(true),
        logUri: context.logUri.toString(true),
    });
    logHeader("Test VsCodeExtensionContext end");
}

async function testBrLog(context: vscode.ExtensionContext): Promise<void> {
    logHeader("Test BrLog start");
    // log messages of various levels
    logger.fatal("Some fatal 1");
    logger.error("Some error 1");
    logger.warning("Some warning 1");
    logger.info("Some info 1");
    logger.debug("Some debug 1");
    // log with objects and array
    logger.fatal("Now log with additional data!");
    logger.fatal("Undefined", { data: undefined });
    logger.fatal("Null", { data: null });
    logger.fatal("Boolean", { data: false });
    logger.fatal("Number", { data: 33 });
    logger.fatal("String", { data: "hello" });
    const someObj = { a: "hello", b: "world", c: 33, d: { d1: 20, d2: "42" } };
    logger.fatal("Obj", { data: someObj });
    const someArray = [{ a: 33, b: { b1: 33, b2: false } }, undefined, "hello", 33, false, null, { q: "testQ", r: "testR" }];
    logger.fatal("Array", { data: someArray });
    logHeader("Test BrLog end");
}

async function testStatusBar(context: vscode.ExtensionContext): Promise<void> {
    logHeader("Test StatusBar start");
    // start multiple timers
    const resolveIn5 = new Promise((resolve) => setTimeout(resolve, 5000));
    const resolveIn10 = new Promise((resolve) => setTimeout(resolve, 10000));
    const resolveIn15 = new Promise((resolve) => setTimeout(resolve, 15000));
    const rejectIn20 = new Promise((resolve, reject) => setTimeout(reject, 20000));
    const resolveIn25 = new Promise((resolve) => setTimeout(resolve, 25000));
    const resolveIn30 = new Promise((resolve) => setTimeout(resolve, 30000));
    // Normal busy items
    statusBar.addBusyItem(resolveIn5, "Resolve in 5 seconds");
    statusBar.addBusyItem(resolveIn10, "Resolve in 10 seconds");
    statusBar.addBusyItem(rejectIn20, "Reject in 20 seconds");
    // manual remove busy item
    const manualRemove = statusBar.addBusyItem(resolveIn15, "Resolve in 15 seconds, but remove after 10");
    void resolveIn10.then(() => statusBar.removeBusyItem(manualRemove));
    // empty busy item coming later
    void resolveIn25.then(() => statusBar.addBusyItem(resolveIn30));
    // Show look and feel test dummys
    statusBar.showConfigAndDeployedDummy(resolveIn30);
    logHeader("Test StatusBar end");
}

async function testPlcLookup(context: vscode.ExtensionContext): Promise<void> {
    logHeader("Test PLC lookup start");
    //TODO move to unit tests
    // internal function to get and log
    const getAndLog = (moduleId: string): string => {
        const props = getPlcProperties(moduleId);
        return `'${moduleId}' -> '${props.familyName}' (${props.systemGeneration}, ${props.architecture})`;
    };
    // list of tested modules
    const moduleIds = [
        // Generic
        "PC_any",
        // X20CP13xx
        "X20CP1301",
        "X20cCP1301",
        "X20CP1381",
        "X20CP1381-RT",
        "X20CP1382",
        "X20CP1382-RT",
        "X20cCP1382-RT",
        // X20CP14xx / X20CP34xx
        "X20CP1483",
        "X20CP1483-1",
        "X20CP1484",
        "X20CP1485-1",
        "X20CP3484",
        "X20CP3485-1",
        // X20CP15xx / X20CP35xx
        "X20CP1585",
        "X20cCP1586",
        "X20CP3585",
        "X20cCP3586",
        // X20CP16xx / X2036xx
        "X20CP1684",
        "X20CP1685",
        "X20CP1686X",
        "X20CP3685",
        "X20CP3687X",
        // X20CP04xx
        "X20CP0410",
        "X20cCP0410",
        "X20CP0411",
        "X20CP0420",
        "X20CP0483",
        "X20CP0484-1",
        // X20EMx6xx
        "X20EM0611",
        "X20EM0612",
        "X20EM0613",
        "X20EM1611",
        "X20EM1612",
        "X20EM1613",
        // X90CP
        "X90CP172.24-00",
        "X90CP172.48-00",
        "X90CP174.24-00",
        "X90CP174.48-00",
        "X90CP174.48-S1",
        // APC2100 / PPC2100 / APC2200 / PPC2200
        "5APC2100.BY34-000",
        "5PPC2100.BY11-000",
        "5APC2200.AL14-000",
        "5PPC2200.AL18-000",
        // APC3100 / PPC3100 / MPC3100
        "5APC3100.KBU2-000",
        "5PPC3100.KBU0-000",
        "5MPC3100.K038-000",
        // APC910 / PPC910
        "5PC900.TS17-01",
        "5PC901.TS17-02",
        "5PC900.TS77-03",
        "5PC901.TS77-07",
        // C30 / C50 / C70 / C80
        "4PPC30.043F-22B",
        "4PPC30.0702-21B",
        "4PPC30.101G-23B",
        "4PPC50.0702-10B",
        "4PPC50.121E-10B",
        "4PPC50.156B-13A",
        "4PPC70.0573-21W",
        "4PPC70.057L-22B",
        "4PPC70.070M-20W",
        "4PPC70.101N-20B",
        "4PPC80.0573-11B",
        "4PPC80.121E-10A",
        "4PPC80.156B-13B",
    ];
    // test all modules and log
    moduleIds.map((id) => logger.info(getAndLog(id)));
    logHeader("Test PLC lookup end");
}

function logHeader(text: string): void {
    const separator = "".padEnd(100, "*");
    logger.info("");
    logger.info(separator);
    logger.info(text);
    logger.info(separator);
    logger.info("");
}

async function selectFile(): Promise<vscode.Uri | undefined> {
    const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: "Select",
        canSelectFiles: true,
        canSelectFolders: false,
    };
    const selection = await vscode.window.showOpenDialog(options);
    return selection?.[0];
}
