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
import * as BREnvironment from '../BREnvironment';
import * as BRConfiguration from '../BRConfiguration';
import * as BRAsProjectWorkspace from '../BRAsProjectWorkspace';
import * as BrAsProjectFiles from '../BrAsProjectFiles';
//import * as NAME from '../BRxxxxxx';


/**
 * Register test functionality
 * @param context The extension context
 */
export function registerApiTests(context: vscode.ExtensionContext) {
	let disposable: vscode.Disposable | undefined;
	
	// Command: Test
	disposable = vscode.commands.registerCommand('vscode-brautomationtools.test',
		(arg1, arg2) => testCommand(arg1, arg2));
    context.subscriptions.push(disposable);
}


async function testCommand(arg1: any, arg2: any) {
	Helpers.logTimedHeader('Test command start');
	// select tests to execute
	if (await yesNoDialog('Run various tests?')) {
		await testVarious(arg1, arg2);
	}
	if (await yesNoDialog('Run tests for UriTools?')) {
		await testUriTools();
	}
	if (await yesNoDialog('Run tests for FileTools?')) {
		await testFileTools();
	}
	if (await yesNoDialog('Run tests for Helpers?')) {
		await testHelpers();
	}
	if (await yesNoDialog('Run tests for file system events?')) {
		await testFileSystemEvents();
	}
	if (await yesNoDialog('Run tests for BREnvironment?')) {
		await testBREnvironment();
	}
	if (await yesNoDialog('Run tests for BRConfiguration?')) {
		await testBRConfiguration();
	}
	if (await yesNoDialog('Run tests for BRAsProjectWorkspace?')) {
		await testBRAsProjectWorkspace();
	}
	if (await yesNoDialog('Run tests for BrAsProjectFiles?')) {
		await testBrAsProjectFiles();
	}
	// end
	Helpers.logTimedHeader('Test command end');
}

async function testVarious(arg1: any, arg2: any)
{
	console.warn('Test various start');
	// check command arguments
	console.log('arg1 and arg2:');
	console.log(arg1);
	console.log(arg2);
	// console timer tests
	console.log('Timer tests');
	console.time('testVarious_timer');
	console.timeStamp('testVarious_timestamp'); // -> cannot be seen in the debug console
	await Helpers.delay(200);
	console.timeLog('testVarious_timer', 'timeLog() 1');
	await Helpers.delay(200);
	console.timeLog('testVarious_timer', 'timeLog() 2');
	await Helpers.delay(200);
	console.timeEnd('testVarious_timer');
	await Helpers.delay(200);
	console.timeLog('testVarious_timer', 'timeLog() after timeEnd()'); // -> Warning: No such label 'testVarious_timer' for console.timeLog()
	// xmlbuilder tests
	console.log('xmlbuilder tests');
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
		console.log(rootNode);
	} catch (error) {
		console.log('xmlbuilder error');
		console.log(error);
	}
	// end
	console.warn('Test various end');
}

async function testFileSystemEvents() {
	console.warn('Test file system events start');
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
	console.log('createFileSystemWatcher:');
	console.log(pattern);
	const watcher = vscode.workspace.createFileSystemWatcher(pattern);
	watcher.onDidChange(uri => {
		console.log('File changed:');
		console.log(uri);
	});
	watcher.onDidCreate(uri => {
		console.log('File created:');
		console.log(uri);
	});
	watcher.onDidDelete(uri => {
		console.log('File deleted:');
		console.log(uri);
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
	const renameSubscript = vscode.workspace.onDidRenameFiles(event => {
		console.log('Files renamed from -> to:');
		for (const file of event.files) {
			console.log(`${file.oldUri.fsPath} -> ${file.newUri.fsPath}`);
		}
	});
	console.warn('Test file system events end');
}


async function testUriTools() {
	console.warn('Test UriTools start');
	// test pathRelative and isSubOf
	const uriFrom = vscode.Uri.file('C:\\Temp\\');
	const uriToIsSub = vscode.Uri.file('c:\\Temp\\Test1\\test.txt');
	const uriToNotSub = vscode.Uri.file('C:\\User\\Test1\\test.txt');
	console.log(`uriTools.pathRelative from '${uriFrom.path}' to '${uriToIsSub.path}' --> '${uriTools.pathRelative(uriFrom, uriToIsSub)}'`);
	console.log(`uriTools.pathRelative from '${uriFrom.path}' to '${uriToNotSub.path}' --> '${uriTools.pathRelative(uriFrom, uriToNotSub)}'`);
	console.log(`uriTools.isSubOf base '${uriFrom.path}' uri '${uriToIsSub.path}' --> '${uriTools.isSubOf(uriFrom, uriToIsSub)}'`);
	console.log(`uriTools.isSubOf base '${uriFrom.path}' uri '${uriToNotSub.path}' --> '${uriTools.isSubOf(uriFrom, uriToNotSub)}'`);
	// test pathsFromTo
	console.log(`uriTools.pathsFromTo from '${uriFrom.path}' to '${uriToIsSub.path}'`);
	const fromToIsSub = uriTools.pathsFromTo(uriFrom, uriToIsSub);
	console.log(fromToIsSub);
	console.log(`uriTools.pathsFromTo from '${uriFrom.path}' to '${uriToNotSub.path}'`);
	const fromToNotSub = uriTools.pathsFromTo(uriFrom, uriToNotSub);
	console.log(fromToNotSub);
	console.log(`uriTools.pathsFromTo from '${uriFrom.path}' to '${uriFrom.path}'`);
	const fromToSame = uriTools.pathsFromTo(uriFrom, uriFrom);
	console.log(fromToSame);
	// test pathsFromTo with replace
	const uriReplace = vscode.Uri.file('C:\\Replace\\');
	console.log(`uriTools.pathsFromTo from '${uriFrom.path}' to '${uriToIsSub.path}' replace '${uriReplace.path}'`);
	const fromToIsSubReplace = uriTools.pathsFromTo(uriFrom, uriToIsSub, uriReplace);
	console.log(fromToIsSubReplace);
	console.log(`uriTools.pathsFromTo from '${uriFrom.path}' to '${uriToNotSub.path}' replace '${uriReplace.path}'`);
	const fromToNotSubReplace = uriTools.pathsFromTo(uriFrom, uriToNotSub, uriReplace);
	console.log(fromToNotSubReplace);
	console.log(`uriTools.pathsFromTo from '${uriFrom.path}' to '${uriFrom.path}' replace '${uriReplace.path}'`);
	const fromToSameReplace = uriTools.pathsFromTo(uriFrom, uriFrom, uriReplace);
	console.log(fromToSameReplace);
	// end
	console.warn('Test UriTools end');
}


async function testFileTools() {
	console.warn('Test FileTools start');
	if (!vscode.workspace.workspaceFolders) {
		console.log('No workspace folder defined');
		return;
	}
	const wsUri = vscode.workspace.workspaceFolders[0].uri;
	const fileUri = uriTools.pathJoin(wsUri, 'MyTempFile.txt');
	console.log(`Creating file ${fileUri.fsPath}`);
	await fileTools.createFile(fileUri, {overwrite: true});
	console.log(`Insert text into file ${fileUri.fsPath}`);
	await fileTools.insertTextInFile(fileUri, new vscode.Position(0, 0), 'asdf');
	console.warn('Test FileTools end');
}


async function testHelpers() {
	// test pushDefined
	console.log('Helpers.pushDefined');
	const mixedValues = [true, false, undefined, null];
	const result: boolean[] = [];
	Helpers.pushDefined(result, ...mixedValues);
	Helpers.pushDefined(result, undefined);
	Helpers.pushDefined(result, null);
	Helpers.pushDefined(result, true);
	Helpers.pushDefined(result, false);
	console.log(result);
}


async function testBREnvironment() {
	console.warn('Test BREnvironment start');
	// Update AS versions
	if (await yesNoDialog('Update AS versions?')) {
		console.log('BREnvironment.updateAvailableAutomationStudioVersions');
		console.time('BREnvironment.updateAvailableAutomationStudioVersions');
		await BREnvironment.updateAvailableAutomationStudioVersions();
		console.timeEnd('BREnvironment.updateAvailableAutomationStudioVersions');
	}
	// get AS version info
	console.log('BREnvironment.getAvailableAutomationStudioVersions');
	const asVersions = await BREnvironment.getAvailableAutomationStudioVersions();
	console.log(asVersions);
	// get BR.AS.Build.exe
	const inputAsVersion = await vscode.window.showInputBox({prompt: 'Enter an AS version to find BR.AS.Build.exe'});
	if (inputAsVersion) {
		console.log(`BREnvironment.getBrAsBuilExe for version: ${inputAsVersion}`);
		const buildExe = await BREnvironment.getBrAsBuilExe(inputAsVersion);
		console.log(buildExe);
	}
	// get gcc target system info
	const getTargetInfoAsVersion = '4.6.5';
	const getTargetInfoGccVersion = '4.1.2';
	const getTargetSystemType = 'SG4 Ia32';
	console.log(`BREnvironment.getGccTargetSystemInfo for AS: ${getTargetInfoAsVersion}; gcc: ${getTargetInfoGccVersion}; type: ${getTargetSystemType}`);
	const targetSystemInfo = await BREnvironment.getGccTargetSystemInfo(getTargetInfoAsVersion, getTargetInfoGccVersion, getTargetSystemType);
	console.log(targetSystemInfo);
	// Update PVI versions
	if (await yesNoDialog('Update PVI versions?')) {
		console.log('BREnvironment.updateAvailablePviVersions');
		console.time('BREnvironment.updateAvailablePviVersions');
		await BREnvironment.updateAvailablePviVersions();
		console.timeEnd('BREnvironment.updateAvailablePviVersions');
	}
	// get PVI version info
	console.log('BREnvironment.getAvailablePviVersions');
	const pviVersions = await BREnvironment.getAvailablePviVersions();
	console.log(pviVersions);
	// get PVITransfer.exe
	const inputPviVersion = await vscode.window.showInputBox({prompt: 'Enter a PVI version to find PVITransfer.exe'});
	console.log(`BREnvironment.getPviTransferExe for version: ${inputPviVersion}`);
	const transferExe = await BREnvironment.getPviTransferExe(inputPviVersion);
	console.log(transferExe);

	// end
	console.warn('Test BREnvironment end');
}


async function testBRConfiguration() {
	console.warn('Test BRConfiguration start');
	// Get AS install paths
	console.log('BRConfiguration.getAutomationStudioInstallPaths');
	const installPaths = BRConfiguration.getAutomationStudioInstallPaths();
	console.log(installPaths);
	// get default build mode
	console.log('BRConfiguration.getDefaultBuildMode');
	const defaultBuildMode = BRConfiguration.getDefaultBuildMode();
	console.log(defaultBuildMode);
	// end
	console.warn('Test BRConfiguration end');
}


async function testBRAsProjectWorkspace() {
	console.warn('Test BRAsProjectWorkspace start');
	// Update AS projects
	if (await yesNoDialog('Update AS projects in workspace?')) {
		console.log('BRAsProjectWorkspace.updateWorkspaceProjects');
		console.time('BRAsProjectWorkspace.updateWorkspaceProjects');
		const numProjects = await BRAsProjectWorkspace.updateWorkspaceProjects();
		console.timeEnd('BRAsProjectWorkspace.updateWorkspaceProjects');
		console.log(`${numProjects} found`);
	}
	// Get AS projects info
	console.log('BRAsProjectWorkspace.getWorkspaceProjects');
	const projectsData = await BRAsProjectWorkspace.getWorkspaceProjects();
	console.log(projectsData);
	// find project for path
	const pathToGetProject = await vscode.window.showInputBox({prompt: 'Enter path to get corresponding project'});
	if (pathToGetProject) {
		console.log(`BRAsProjectWorkspace.getProjectForUri(${pathToGetProject})`);
		const projectForPath = await BRAsProjectWorkspace.getProjectForUri(vscode.Uri.file(pathToGetProject));
		console.log(projectForPath);
	}
	// Get header directories
	const pathToGetHeaderDirs = await vscode.window.showInputBox({prompt: 'Enter path to get corresponding header directories'});
	if (pathToGetHeaderDirs) {
		console.log(`BRAsProjectWorkspace.getProjectHeaderIncludeDirs(${pathToGetHeaderDirs})`);
		const headerDirsForPath = await BRAsProjectWorkspace.getProjectHeaderIncludeDirs(vscode.Uri.file(pathToGetHeaderDirs));
		console.log(headerDirsForPath);
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
	console.warn('Test BRAsProjectWorkspace end');
}


export async function testBrAsProjectFiles(): Promise<void> {
	console.warn('Test BrAsProjectFiles start');
	// get AS project for further tests
    const asProjects = await BRAsProjectWorkspace.getWorkspaceProjects();
    if (asProjects.length === 0) {
        return;
    }
	const asProject = asProjects[0];
	// test *.apj info
	console.log(`BrAsProjectFiles.getProjectFileInfo`);
	const projectInfo = await BrAsProjectFiles.getProjectFileInfo(asProject.projectFile);
	console.log(projectInfo);
	// test Physical.pkg info
	console.log('BrAsProjectFiles.getPhysicalPackageInfo');
	const physicalInfo = await BrAsProjectFiles.getPhysicalPackageInfo(uriTools.pathJoin(asProject.physical, 'Physical.pkg'));
	console.log(physicalInfo);
	// test *.set info
	console.log('BrAsProjectFiles.getUserSettingsInfo');
	const settingFiles = await vscode.workspace.findFiles({base: asProject.baseUri.fsPath, pattern: '*.set'});
	const settingsInfos = await Promise.all(
			settingFiles.map(async file => {
				return {uri: file, data: await BrAsProjectFiles.getUserSettingsInfo(file)};
			})
		);
	console.log(settingsInfos);
	// test Config.pkg info
	console.log('BrAsProjectFiles.getConfigPackageInfo');
	const configPkgFiles = await vscode.workspace.findFiles({base: asProject.physical.fsPath, pattern: '*/Config.pkg'});
	const configPkgInfos = await Promise.all(
		configPkgFiles.map(async file => {
			return {uri: file, data: await BrAsProjectFiles.getConfigPackageInfo(file)};
		})
	);
	console.log(configPkgInfos);
	// test Cpu.pkg info
	console.log('BrAsProjectFiles.getCpuPackageInfo');
	const cpuPkgFiles = await vscode.workspace.findFiles({base: asProject.physical.fsPath, pattern: '*/*/Cpu.pkg'});
	const cpuPkgInfos = await Promise.all(
		cpuPkgFiles.map(async file => {
			return {uri: file, data: await BrAsProjectFiles.getCpuPackageInfo(file)};
		})
	);
	console.log(cpuPkgInfos);
	//end
    console.warn('Test BrAsProjectFiles end');
}


async function yesNoDialog(prompt?: string): Promise<boolean> {
	const selected = await vscode.window.showQuickPick(['no', 'yes'], {placeHolder: prompt});
	return selected === 'yes';
}