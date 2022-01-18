/**
 * Tests for APIs by invoking a test command
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import * as xmlbuilder from 'xmlbuilder2';
import * as xmlDom from '@oozcitak/dom/lib/dom/interfaces';
import * as Helpers from './Helpers';
import * as uriTools from './UriTools';
import * as fileTools from './FileTools';
import * as Dialogs from '../UI/Dialogs';
import * as BREnvironment from '../Environment/BREnvironment';
import * as BRAsProjectWorkspace from '../BRAsProjectWorkspace';
import * as BrAsProjectFiles from '../BrAsProjectFiles';
import { logger } from '../BrLog';
import { extensionConfiguration } from '../BRConfiguration';
import { statusBar } from '../UI/StatusBar';
import { Pvi } from '../Environment/Pvi';
//import * as NAME from '../BRxxxxxx';


/**
 * Register test functionality
 * @param context The extension context
 */
export function registerApiTests(context: vscode.ExtensionContext) {
	let disposable: vscode.Disposable | undefined;
	
	// Command: Test
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.test',
		(arg1, arg2) => testCommand(arg1, arg2, context));
    context.subscriptions.push(disposable);
}


async function testCommand(arg1: any, arg2: any, context: vscode.ExtensionContext) {
	logHeader('Test command start');
	// select tests to execute
	if (await Dialogs.yesNoDialog('Run various tests?')) {
		await testVarious(arg1, arg2);
	}
	if (await Dialogs.yesNoDialog('Run tests for UriTools?')) {
		await testUriTools();
	}
	if (await Dialogs.yesNoDialog('Run tests for FileTools?')) {
		await testFileTools();
	}
	if (await Dialogs.yesNoDialog('Run tests for Helpers?')) {
		await testHelpers();
	}
	if (await Dialogs.yesNoDialog('Run tests for file system events?')) {
		await testFileSystemEvents();
	}
	if (await Dialogs.yesNoDialog('Run tests for BREnvironment?')) {
		await testBREnvironment();
	}
	if (await Dialogs.yesNoDialog('Run tests for PVI?')) {
		await testPvi(context);
	}
	if (await Dialogs.yesNoDialog('Run tests for BRConfiguration?')) {
		await testBRConfiguration();
	}
	if (await Dialogs.yesNoDialog('Run tests for BRAsProjectWorkspace?')) {
		await testBRAsProjectWorkspace();
	}
	if (await Dialogs.yesNoDialog('Run tests for BrAsProjectFiles?')) {
		await testBrAsProjectFiles();
	}
	if (await Dialogs.yesNoDialog('Run tests for VS Code extension context?')) {
		await testVsCodeExtensionContext(context);
	}
	if (await Dialogs.yesNoDialog('Run tests for BrLog')) {
		await testBrLog(context);
	}
	if (await Dialogs.yesNoDialog('Run tests for StatusBar')) {
		await testStatusBar(context);
	}
	// end
	logHeader('Test command end');
}

async function testVarious(arg1: any, arg2: any) {
	logHeader('Test various start');
	// check command arguments
	logger.info('arg1 and arg2:', {arg1: arg1, arg2: arg2});
	// xmlbuilder tests
	const xmlTextNormal =          `<?xml version="1.0" encoding="utf-8"?>
									<?AutomationStudio Version=4.6.5.78 SP?>
									<Physical xmlns="http://br-automation.co.at/AS/Physical">
									<Objects>
										<Object Type="Configuration" Description="No errors and no warnings">NoErrNoWrn</Object>
										<Object Type="Configuration">Warnings</Object>
										<Object Type="Configuration">Errors</Object>
									</Objects>
									</Physical>`;
	const xmlTextNoRootCont =    `<?xml version="1.0" encoding="utf-8"?>
								  <?AutomationStudio Version=4.6.5.78 SP?>
								  </root>`;
	const xmlTextNoRoot =        `<?xml version="1.0" encoding="utf-8"?>
					        	  <?AutomationStudio Version=4.6.5.78 SP?>`;
	const xmlTextMultiRoot =     `<?xml version="1.0" encoding="utf-8"?>
								  <?AutomationStudio Version=4.6.5.78 SP?>
								  <root1>Hello1</root1>
								  <root2>Hello2</root2>`;
	try {
		const builder = xmlbuilder.create(xmlTextNormal); // throws on invalid XML (xmlTextNoRootCont, xmlTextMultiRoot)
		const rootBld = builder.root(); // throws when no root is available (xmlTextNoRoot)
		const rootNode = rootBld.node as xmlDom.Element;
		logger.info('xmlbuilder tests', {rootNode: rootNode});
	} catch (error) {
		logger.info('xmlbuilder test error', {error: error});
	}
	// end
	logHeader('Test various end');
}

async function testFileSystemEvents() {
	logHeader('Test file system events start');
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
	const pattern = '**';
	logger.info('createFileSystemWatcher:', {pattern: pattern});
	const watcher = vscode.workspace.createFileSystemWatcher(pattern);
	watcher.onDidChange((uri) => {
		logger.info('File changed:', { uri: uri.toString(true) });
	});
	watcher.onDidCreate((uri) => {
		logger.info('File created:', { uri: uri.toString(true) });
	});
	watcher.onDidDelete((uri) => {
		logger.info('File deleted:', { uri: uri.toString(true) });
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
		logger.info('Files renamed from -> to:', {fromTo: fromTo});
	});
	logHeader('Test file system events end');
}


async function testUriTools() {
	logHeader('Test UriTools start');
	const uriFrom = vscode.Uri.file('C:\\Temp\\');
	const uriToIsSub = vscode.Uri.file('c:\\Temp\\Test1\\test.txt');
	const uriToNotSub = vscode.Uri.file('C:\\User\\Test1\\test.txt');
	// test pathRelative
	logger.info('uriTools.pathRelative(from, to)', {
		from: uriFrom.path,
		to: uriToIsSub.path,
		result: uriTools.pathRelative(uriFrom, uriToIsSub)
	});
	logger.info('uriTools.pathRelative(from, to)', {
		from: uriFrom.path,
		to: uriToNotSub.path,
		result: uriTools.pathRelative(uriFrom, uriToNotSub)
	});
	// test isSubOf
	logger.info('uriTools.isSubOf(base, uri)', {
		base: uriFrom.path,
		uri: uriToIsSub.path,
		result: uriTools.isSubOf(uriFrom, uriToIsSub)
	});
	logger.info('uriTools.isSubOf(base, uri)', {
		base: uriFrom.path,
		uri: uriToNotSub.path,
		result: uriTools.isSubOf(uriFrom, uriToNotSub)
	});
	// test pathsFromTo
	logger.info('uriTools.pathsFromTo(from, to)', {
		from: uriFrom.path,
		to: uriToIsSub.path,
		result: uriTools.pathsFromTo(uriFrom, uriToIsSub)
	});
	logger.info('uriTools.pathsFromTo(from, to)', {
		from: uriFrom.path,
		to: uriToNotSub.path,
		result: uriTools.pathsFromTo(uriFrom, uriToNotSub)
	});
	logger.info('uriTools.pathsFromTo(from, to)', {
		from: uriFrom.path,
		to: uriFrom.path,
		result: uriTools.pathsFromTo(uriFrom, uriFrom)
	});
	// test pathsFromTo with replace
	const uriReplace = vscode.Uri.file('C:\\Replace\\');
	logger.info('uriTools.pathsFromTo(from, to, replace)', {
		from: uriFrom.path,
		to: uriToIsSub.path,
		replace: uriReplace.path,
		result: uriTools.pathsFromTo(uriFrom, uriToIsSub, uriReplace)
	});
	logger.info('uriTools.pathsFromTo(from, to, replace)', {
		from: uriFrom.path,
		to: uriToNotSub.path,
		replace: uriReplace.path,
		result: uriTools.pathsFromTo(uriFrom, uriToNotSub, uriReplace)
	});
	logger.info('uriTools.pathsFromTo(from, to, replace)', {
		from: uriFrom.path,
		to: uriFrom.path,
		replace: uriReplace.path,
		result: uriTools.pathsFromTo(uriFrom, uriFrom, uriReplace)
	});
	// end
	logHeader('Test UriTools end');
}


async function testFileTools() {
	logHeader('Test FileTools start');
	if (!vscode.workspace.workspaceFolders) {
		logger.info('No workspace folder defined');
		return;
	}
	const wsUri = vscode.workspace.workspaceFolders[0].uri;
	const fileUri = uriTools.pathJoin(wsUri, 'MyTempFile.txt');
	logger.info(`Creating file ${fileUri.fsPath}`);
	await fileTools.createFile(fileUri, {overwrite: true});
	logger.info(`Insert text into file ${fileUri.fsPath}`);
	await fileTools.insertTextInFile(fileUri, new vscode.Position(0, 0), 'asdf');
	// end
	logHeader('Test FileTools end');
}


async function testHelpers() {
	logHeader('Test Helpers start');
	// test pushDefined
	const mixedValues = [true, false, undefined, null];
	const result: boolean[] = [];
	Helpers.pushDefined(result, ...mixedValues);
	Helpers.pushDefined(result, undefined);
	Helpers.pushDefined(result, null);
	Helpers.pushDefined(result, true);
	Helpers.pushDefined(result, false);
	logger.info('Helpers.pushDefined()', { result: result });
	// end
	logHeader('Test Helpers end');
}


async function testBREnvironment() {
	logHeader('Test BREnvironment start');
	// Update AS versions
	if (await Dialogs.yesNoDialog('Update AS versions?')) {
		logger.info('BREnvironment.updateAvailableAutomationStudioVersions() start');
		const result = await BREnvironment.updateAvailableAutomationStudioVersions();
		logger.info('BREnvironment.updateAvailableAutomationStudioVersions() done', { result: result });
	}
	// get AS version info
	const asVersions = await BREnvironment.getAvailableAutomationStudioVersions();
	logger.info('BREnvironment.getAvailableAutomationStudioVersions()', { result: asVersions });
	// get BR.AS.Build.exe
	const inputAsVersion = await vscode.window.showInputBox({prompt: 'Enter an AS version to find BR.AS.Build.exe'});
	if (inputAsVersion) {
		const buildExe = await BREnvironment.getBrAsBuilExe(inputAsVersion);
		logger.info('BREnvironment.getBrAsBuilExe(requested)', { requested: inputAsVersion, result: buildExe });
	}
	// get gcc target system info
	const getTargetInfoAsVersion = '4.6.5';
	const getTargetInfoGccVersion = '4.1.2';
	const getTargetSystemType = 'SG4 Ia32';
	const targetSystemInfo = await BREnvironment.getGccTargetSystemInfo(getTargetInfoAsVersion, getTargetInfoGccVersion, getTargetSystemType);
	logger.info('BREnvironment.getGccTargetSystemInfo(asVersion, gccVersion, targetSystem)', {
		asVersion: getTargetInfoAsVersion,
		gccVersion: getTargetInfoGccVersion,
		targetSystem: getTargetSystemType,
		result: targetSystemInfo
	});

	// end
	logHeader('Test BREnvironment end');
}


async function testPvi(context: vscode.ExtensionContext): Promise<void> {
	logHeader('Test PVI start');
	const highestPvi = await Pvi.getPviVersion();
	logger.info('highest PVI', { pvi: highestPvi?.rootUri.fsPath });
	const pviV48 = await Pvi.getPviVersion('4.8');
	logger.info('PVI V4.8 not strict', { pvi: pviV48?.rootUri.fsPath });
	const pviV48Strict = await Pvi.getPviVersion('4.8', true);
	logger.info('PVI V4.8 strict', { pvi: pviV48Strict?.rootUri.fsPath });
	const pviV46 = await Pvi.getPviVersion('4.6');
	logger.info('PVI V4.6 not strict', { pvi: pviV46?.rootUri.fsPath });
	const pviV46Strict = await Pvi.getPviVersion('4.6', true);
	logger.info('PVI V4.6 strict', { pvi: pviV46Strict?.rootUri.fsPath });
	const update = await Dialogs.yesNoDialog('Update PVI versions?');
	if (update) {
		await Pvi.updatePviVersions();
	}
	logHeader('Test PVI end');
}


async function testBRConfiguration() {
	logHeader('Test BRConfiguration start');
	logger.info('Get configuration values', {
		build: {
			defaultBuildMode: extensionConfiguration.build.defaultBuildMode
		},
		environment: {
			automationStudioInstallPaths: extensionConfiguration.environment.automationStudioInstallPaths,
			pviInstallPaths: extensionConfiguration.environment.pviInstallPaths
		},
		logging: {
			logLevel: extensionConfiguration.logging.logLevel,
			prettyPrintAdditionalData: extensionConfiguration.logging.prettyPrintAdditionalData
		},
		notifications: {
			hideActivationMessage: extensionConfiguration.notifications.hideActivationMessage,
			hideNewVersionMessage: extensionConfiguration.notifications.hideNewVersionMessage
		}
	});
	// end
	logHeader('Test BRConfiguration end');
}


async function testBRAsProjectWorkspace() {
	logHeader('Test BRAsProjectWorkspace start');
	// Update AS projects
	if (await Dialogs.yesNoDialog('Update AS projects in workspace?')) {
		logger.info('BRAsProjectWorkspace.updateWorkspaceProjects() start');
		const numProjects = await BRAsProjectWorkspace.updateWorkspaceProjects();
		logger.info('BRAsProjectWorkspace.updateWorkspaceProjects() done', { result: numProjects });
	}
	// Get AS projects info
	const projectsData = await BRAsProjectWorkspace.getWorkspaceProjects();
	logger.info('BRAsProjectWorkspace.getWorkspaceProjects()', { result: projectsData });
	// find project for path
	const pathToGetProject = await vscode.window.showInputBox({prompt: 'Enter path to get corresponding project'});
	if (pathToGetProject) {
		const uri = vscode.Uri.file(pathToGetProject);
		const projectForPath = await BRAsProjectWorkspace.getProjectForUri(uri);
		logger.info('BRAsProjectWorkspace.getProjectForUri(uri)', { uri: uri.toString(true), result: projectForPath });
	}
	// Get header directories
	const pathToGetHeaderDirs = await vscode.window.showInputBox({prompt: 'Enter path to get corresponding header directories'});
	if (pathToGetHeaderDirs) {
		const uri = vscode.Uri.file(pathToGetHeaderDirs);
		const headerDirsForPath = await BRAsProjectWorkspace.getProjectHeaderIncludeDirs(uri);
		logger.info('BRAsProjectWorkspace.getProjectHeaderIncludeDirs(uri)', { uri: uri.toString(true), result: headerDirsForPath });
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
	logHeader('Test BRAsProjectWorkspace end');
}


async function testBrAsProjectFiles(): Promise<void> {
	logHeader('Test BrAsProjectFiles start');
	// get AS project for further tests
    const asProjects = await BRAsProjectWorkspace.getWorkspaceProjects();
    if (asProjects.length === 0) {
        return;
    }
	const asProject = asProjects[0];
	// test *.apj info
	const projectInfo = await BrAsProjectFiles.getProjectFileInfo(asProject.projectFile);
	logger.info('BrAsProjectFiles.getProjectFileInfo(prjFile)', { prjFile: asProject.projectFile.toString(false), result: projectInfo });
	// test Physical.pkg info
	const physicalPkgFile = uriTools.pathJoin(asProject.physical, 'Physical.pkg');
	const physicalInfo = await BrAsProjectFiles.getPhysicalPackageInfo(physicalPkgFile);
	logger.info('BrAsProjectFiles.getPhysicalPackageInfo(physicalPkgFile)', { physicalPkgFile: physicalPkgFile.toString(false), result: physicalInfo });
	// test *.set info
	const settingFiles = await vscode.workspace.findFiles({ base: asProject.baseUri.fsPath, pattern: '*.set' });
	for (const file of settingFiles) {
		const result = await BrAsProjectFiles.getUserSettingsInfo(file);
		logger.info('BrAsProjectFiles.getUserSettingsInfo(uri)', { uri: file.toString(true), result: result });
	}
	// test Config.pkg info
	const configPkgFiles = await vscode.workspace.findFiles({base: asProject.physical.fsPath, pattern: '*/Config.pkg'});
	for (const file of configPkgFiles) {
		const result = await BrAsProjectFiles.getConfigPackageInfo(file);
		logger.info('BrAsProjectFiles.getConfigPackageInfo(uri)', { uri: file.toString(true), result: result });	
	}
	// test Cpu.pkg info
	console.log('BrAsProjectFiles.getCpuPackageInfo');
	const cpuPkgFiles = await vscode.workspace.findFiles({ base: asProject.physical.fsPath, pattern: '*/*/Cpu.pkg' });
	for (const file of cpuPkgFiles) {
		const result = await BrAsProjectFiles.getCpuPackageInfo(file);
		logger.info('BrAsProjectFiles.getCpuPackageInfo(uri)', { uri: file.toString(true), result: result });
	}
	//end
    logHeader('Test BrAsProjectFiles end');
}


async function testVsCodeExtensionContext(context: vscode.ExtensionContext) : Promise<void> {
	//TODO can be used for generated files, user query flags...
	// see https://code.visualstudio.com/api/extension-capabilities/common-capabilities#data-storage
	logHeader('Test VsCodeExtensionContext start');
	// Storage for temporary files, e.g. generated headers, PIL files...
	logger.info('vscode.ExtensionContext values', {
		extensionPath: context.extensionPath,
		extensionUri: context.extensionUri.toString(true),
		extensionMode: context.extensionMode,
		globalStorageUri: context.globalStorageUri.toString(true),
		storageUri: context.storageUri?.toString(true),
		logUri: context.logUri.toString(true)
	});
	logHeader('Test VsCodeExtensionContext end');
}


async function testBrLog(context: vscode.ExtensionContext): Promise<void> {
	logHeader('Test BrLog start');
	// log messages of various levels
	logger.fatal('Some fatal 1');
	logger.error('Some error 1');
	logger.warning('Some warning 1');
	logger.info('Some info 1');
	logger.debug('Some debug 1');
	// log with objects and array
	logger.fatal('Now log with additional data!');
	logger.fatal('Undefined', { data: undefined });
	logger.fatal('Null', { data: null });
	logger.fatal('Boolean', { data: false });
	logger.fatal('Number', { data: 33 });
	logger.fatal('String', { data: 'hello' });
	const someObj = { a: 'hello', b: 'world', c: 33, d: { d1: 20, d2: '42' } };
	logger.fatal('Obj', { data: someObj });
	const someArray = [{ a: 33, b: { b1: 33, b2: false } }, undefined, 'hello', 33, false, null, { q: 'testQ', r: 'testR' }];
	logger.fatal('Array', { data: someArray });
	logHeader('Test BrLog end');
}


async function testStatusBar(context: vscode.ExtensionContext): Promise<void> {
	logHeader('Test StatusBar start');
	// start multiple timers
	const resolveIn5 = new Promise((resolve) => setTimeout(resolve, 5000));
	const resolveIn10 = new Promise((resolve) => setTimeout(resolve, 10000));
	const resolveIn15 = new Promise((resolve) => setTimeout(resolve, 15000));
	const rejectIn20 = new Promise((resolve, reject) => setTimeout(reject, 20000));
	const resolveIn25 = new Promise((resolve) => setTimeout(resolve, 25000));
	const resolveIn30 = new Promise((resolve) => setTimeout(resolve, 30000));
	// Normal busy items
	statusBar.addBusyItem(resolveIn5, 'Resolve in 5 seconds');
	statusBar.addBusyItem(resolveIn10, 'Resolve in 10 seconds');
	statusBar.addBusyItem(rejectIn20, 'Reject in 20 seconds');
	// manual remove busy item
	const manualRemove = statusBar.addBusyItem(resolveIn15, 'Resolve in 15 seconds, but remove after 10');
	resolveIn10.then(() => statusBar.removeBusyItem(manualRemove));
	// empty busy item coming later
	resolveIn25.then(() => statusBar.addBusyItem(resolveIn30));
	// Show look and feel test dummys
	statusBar.showConfigAndDeployedDummy(resolveIn30);
	logHeader('Test StatusBar end');
}


function logHeader(text: string): void {
	const separator = ''.padEnd(100, '*');
	logger.info('');
	logger.info(separator);
	logger.info(text);
	logger.info(separator);
	logger.info('');
}