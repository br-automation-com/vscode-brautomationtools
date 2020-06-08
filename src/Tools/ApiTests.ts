import * as vscode from 'vscode';
import * as BREnvironment from '../BREnvironment';
import * as BRConfiguration from '../BRConfiguration';
import * as Helpers from './Helpers';
import * as uriTools from './UriTools';
//import * as NAME from '../BRxxxxxx';

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
	if (await yesNoDialog('Run tests for BREnvironment?')) {
		await testBREnvironment();
	}
	if (await yesNoDialog('Run tests for BRConfiguration?')) {
		await testBRConfiguration();
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
	// Test URI with wildcard
	console.log('Wildcard URI');
	const wildcardBaseUri = vscode.Uri.file('C:\\BrAutomation\\AS46\\AS\\gnuinst\\V4.1.2\\i386-elf\\include\\');
	const wildcardUri = uriTools.pathJoin(wildcardBaseUri, '*');
	console.log(wildcardUri);
	console.log(wildcardUri.fsPath);
	// end
	console.warn('Test various end');
}

async function testBREnvironment() {
	console.warn('Test BREnvironment start');
	// Update AS versions
	if (await yesNoDialog('Update AS versions?')) {
		console.log('BREnvironment.updateAvailableAutomationStudioVersions');
		await BREnvironment.updateAvailableAutomationStudioVersions();
	}
	// get AS version info
	console.log('BREnvironment.getAvailableAutomationStudioVersions');
	const asVersions = await BREnvironment.getAvailableAutomationStudioVersions();
	console.log(asVersions);
	// get BR.AS.Build.exe
	const inputVersion = await vscode.window.showInputBox({prompt: 'Enter a version to find BR.AS.Build.exe'});
	if (inputVersion) {
		console.log(`BREnvironment.getBrAsBuilExe for version: ${inputVersion}`);
		const buildExe = await BREnvironment.getBrAsBuilExe(inputVersion);
		console.log(buildExe);
	}
	// get gcc target system info
	const getTargetInfoAsVersion = '4.6.5';
	const getTargetInfoGccVersion = '4.1.2';
	const getTargetSystemType = 'SG4 Ia32';
	console.log(`BREnvironment.getGccTargetSystemInfo for AS: ${getTargetInfoAsVersion}; gcc: ${getTargetInfoGccVersion}; type: ${getTargetSystemType}`);
	const targetSystemInfo = await BREnvironment.getGccTargetSystemInfo(getTargetInfoAsVersion, getTargetInfoGccVersion, getTargetSystemType);
	console.log(targetSystemInfo);
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
	// get allowed build modes
	console.log('BRConfiguration.getAllowedBuildModes');
	const allowedBuildModes = BRConfiguration.getAllowedBuildModes();
	console.log(allowedBuildModes);
	// end
	console.warn('Test BRConfiguration end');
}

async function yesNoDialog(prompt?: string): Promise<boolean> {
	const selected = await vscode.window.showQuickPick(['no', 'yes'], {placeHolder: prompt});
	return selected === 'yes';
}