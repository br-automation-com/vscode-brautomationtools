/**
 * Handling of the installation environment of B&R programs on the developer computer.
 * @packageDocumentation
 */
//TODO get version information once on startup, only specify an array of base install paths in the configuration

import * as vscode from 'vscode';
import { Logger } from './BrLog';
import * as uriTools from './Tools/UriTools';
import * as semver from 'semver';
import { extensionConfiguration } from './BRConfiguration';


//#region exported interfaces


/**
 * Base interface for version information
 */
export interface VersionInfo {
	/** The version of the component  */
	version: semver.SemVer;
	/** The base folder URI of the component */
	baseUri: vscode.Uri;
}


/**
 * B&R Automation Studio version and installation information
 */
export interface ASVersionInfo extends VersionInfo {
	/** URI of the BR.AS.Build.exe file */
	brAsBuildExe: vscode.Uri;
	/** Array containing all information of all available gcc versions within this AS version */
    gccVersions: AsGccVersionInfo[];
}

/**
 * Information of gcc installation within B&R Automation Studio
 */
export interface AsGccVersionInfo extends VersionInfo  {
	/** Data for all supported target systems. Access by `targetSystemData['<target> <hardware architecture>']`  */
	targetSystemData: {
		[targetSystem: string]: AsGccTargetSystemInfo
	}
}

/**
 * Target system types in notation '<target> <hardware architecture>'
 */
//TODO maybe use for AsGccVersionInfo.targetSystemData[targetSystem: TargetSystemType], but it gives errors
export type TargetSystemType = 'SG3 M68k' | 'SGC M68k' | 'SG4 Ia32' | 'SG4 Arm';


/**
 * Information of target systems within a gcc installation.
 */
export interface AsGccTargetSystemInfo { //TODO rename? was not fully clear to me after some time not working on this...
	/** URI to gcc.exe for this target system */
	gccExe: vscode.Uri;
}


/**
 * B&R Process Variable Interface (PVI) version and installation information
 */
export interface PviVersionInfo extends VersionInfo {
	pviTransferExe: vscode.Uri;
}


//#endregion exported interfaces

//#region exported functions


/**
 * Gets all available Automation Studio versions in the configured installation paths. The versions are sorted, so the first entry contains the highest version.
 */
export async function getAvailableAutomationStudioVersions(): Promise<ASVersionInfo[]> {
	return await _availableAutomationStudioVersions;
}


/**
 * Updates the installed Automation Studio Version from the configured installation paths.
 */
export async function updateAvailableAutomationStudioVersions(): Promise<void> {
	//TODO return number like in BrAsProjectWorkspace
	//TODO call when configuration value of baseInstallPaths changes
	Logger.default.debug("Start updateAvailableAutomationStudioVersions()");
	_availableAutomationStudioVersions = findAvailableASVersions();
	const versionInfos = await _availableAutomationStudioVersions;
	if (versionInfos.length === 0) {
		const messageItems = ['Change baseInstallPaths'];
		//TODO action for item
		vscode.window.showWarningMessage('No Automation Studio versions found. Build functionality will not be available.', ...messageItems);
		Logger.default.warning('No Automation Studio versions found. Build functionality will not be available.');
		return;
	}

	Logger.default.debug(`${versionInfos.length} Automation Studio versions found`);
}


/**
 * Gets the version information for a specified AS version.
 * @param versionRequest The AS version of the project as a string or semantic version object.
 * @returns `undefined` if no fitting version was found.
 */
export async function getAsVersionInfo(versionRequest: semver.SemVer | string): Promise<ASVersionInfo | undefined> {
	const semanticRequest = semver.coerce(versionRequest);
	if (!semanticRequest) {
		return undefined;
	}
	const fitBugfix = `${semanticRequest.major}.${semanticRequest.minor}.x`;
	const asVersions = await getAvailableAutomationStudioVersions();
	return asVersions.find(v => semver.satisfies(v.version, fitBugfix));
}


/**
 * Gets the BR.AS.Build.exe URI for a specified AS version.
 * @param versionRequest The AS version of the project as a string or semantic version object.
 * @returns `undefined` if no fitting version was found.
 */
export async function getBrAsBuilExe(versionRequest: semver.SemVer | string): Promise<vscode.Uri | undefined> {
	return (await getAsVersionInfo(versionRequest))?.brAsBuildExe;
}


/**
 * Gets the target system information for the specified versions and target system type
 * @param asVersion 
 */
export async function getGccTargetSystemInfo(asVersion: semver.SemVer | string, gccVersion: semver.SemVer | string, targetSystem: TargetSystemType): Promise<AsGccTargetSystemInfo | undefined> {
	const asVersionInfo = await getAsVersionInfo(asVersion);
	const gccVersionInfo = asVersionInfo?.gccVersions.find(v => v.version.compare(gccVersion) === 0);
	if (!gccVersionInfo) {
		return undefined;
	}
	return gccVersionInfo.targetSystemData[targetSystem];
}


/**
 * Get all available PVI versions in the configured installation paths. The versions are sorted, so the first entry contains the highest version.
 */
export async function getAvailablePviVersions(): Promise<PviVersionInfo[]> {
	return await _availablePviVersions;
}


/**
 * Gets the version information for a specified PVI version.
 * @param versionRequest The requested PVI version as a string or semantic version object. If not set, the highest available version will be returned.
 * @returns `undefined` if no fitting version was found.
 */
export async function getPviVersionInfo(versionRequest?: semver.SemVer | string): Promise<PviVersionInfo | undefined> {
	const pviVersions = await getAvailablePviVersions();
	// direct return if no versions available
	if (pviVersions.length <= 0) {
		return undefined;
	}
	// find version depending on versionRequest
	if (versionRequest !== undefined) {
		// search specific version
		const semanticRequest = semver.coerce(versionRequest);
		if (!semanticRequest) {
			return undefined;
		}
		const fitBugfix = `${semanticRequest.major}.${semanticRequest.minor}.x`;
		return pviVersions.find(v => semver.satisfies(v.version, fitBugfix));
	} else {
		// newest version
		return pviVersions[0];
	}
}


/**
 * Updates the installed PVI Version from the configured installation paths.
 */
export async function updateAvailablePviVersions(): Promise<number> {
	_availablePviVersions = findAvailablePviVersions();
	const versions = await _availablePviVersions;
	return versions.length;
}


/**
 * Gets the PVITransfer.exe URI for a specified PVI version.
 * @param versionRequest The requested PVI version as a string or semantic version object. If not set, the highest available version will be returned.
 * @returns `undefined` if no fitting version was found.
 */
export async function getPviTransferExe(versionRequest?: semver.SemVer | string): Promise<vscode.Uri | undefined> {
	return (await getPviVersionInfo(versionRequest))?.pviTransferExe;
}


//#endregion exported functions


//#region local variables


/** Array of all available AS versions. The array is sorted, so that the highest version is always the first array element */
//TODO put functionality in a class to save state, or are local variables like this OK?
let _availableAutomationStudioVersions: Promise<ASVersionInfo[]> = findAvailableASVersions();

/** Array of all available PVI versions. The array is sorted, so that the highest version is always the first array element */
let _availablePviVersions: Promise<PviVersionInfo[]> = findAvailablePviVersions();


//#endregion local variables


//#region local functions


/**
 * Searches for AS installations within the configured installation paths. Search is not recursive!
 */
async function findAvailableASVersions(): Promise<ASVersionInfo[]> {
	const baseInstallUris = extensionConfiguration.environment.automationStudioInstallPaths;
	const versionInfos: ASVersionInfo[] = [];
	for (const uri of baseInstallUris) {
		versionInfos.push(...(await findAvailableASVersionsInUri(uri)));
	}
	// sort by version
	versionInfos.sort((a, b) => semver.compare(b.version, a.version));
	return versionInfos;
}


/**
 * Searches for AS installations within the given URI. Search is not recursive!
 */
async function findAvailableASVersionsInUri(uri: vscode.Uri): Promise<ASVersionInfo[]> {
	Logger.default.debug(`findAvailableASVersionsInUri(${uri.fsPath})`);
	// filter subdirectories with regular expression for AS version
	const subDirectories = await uriTools.listSubDirectoryNames(uri);
	const asDirRegExp = new RegExp(/^AS(\d)(\d+)$/);
	const matching = subDirectories.filter(d => asDirRegExp.test(d)).map(d => asDirRegExp.exec(d));
	// create version information from matching subdirectories
	const versionInfos: ASVersionInfo[] = [];
	for (const match of matching) {
		// create full URI
		const versionBaseUri = uriTools.pathJoin(uri, match![0]);
		// create semantic version
		const version = semver.coerce(`${match![1]}.${match![2]}.0`);
		if (!version) {
			Logger.default.error('Cannot create semantic version for URI: ' + versionBaseUri.fsPath);
			continue;
		}
		// get AS build executable
		//TODO maybe language sensitive for Bin-en / Bin-de if both are available?
		const asBuildExecutables: vscode.Uri[] = [];
		const buildExeUriEn = uriTools.pathJoin(versionBaseUri, 'Bin-en/BR.AS.Build.exe');
		if (await uriTools.exists(buildExeUriEn)) {
			asBuildExecutables.push(buildExeUriEn);
		}
		const buildExeUriDe = uriTools.pathJoin(versionBaseUri, 'Bin-de/BR.AS.Build.exe');
		if (await uriTools.exists(buildExeUriDe)) {
			asBuildExecutables.push(buildExeUriDe);
		}
		if (asBuildExecutables.length === 0) {
			// much slower backup solution if folder structure changes in future AS versions
			asBuildExecutables.push(...await vscode.workspace.findFiles({base: versionBaseUri.fsPath, pattern: '**/BR.AS.Build.exe'}));
			if (asBuildExecutables.length === 0) {
				Logger.default.warning(`Cannot find BR.AS.Build.exe in URI: ${versionBaseUri.fsPath}`);
				continue;
			}
		}
		Logger.default.info(`AS Version V${version.version} found in ${versionBaseUri.fsPath}`);
		const buildExecutable = asBuildExecutables[0];
		// create version information and push to array
		const versionInfo: ASVersionInfo = {
			version: version,
			baseUri: versionBaseUri,
			brAsBuildExe: buildExecutable,
			gccVersions: []
		};
		// find gcc versions and push
		await findAvailableGccVersions(versionInfo);
		versionInfos.push(versionInfo);
	}
	return versionInfos;
}


/**
 * Searches for gcc installations within asVersion.baseUri and pushes all found versions to asVersion.gccVersions
 * @param asVersion AS version info for which gcc versions are searched. asVersion.gccVersions is modified by this function
 */
async function findAvailableGccVersions(asVersion: ASVersionInfo): Promise<void> {
	// remove all existing gcc version
	asVersion.gccVersions.length = 0;
	// filter gcc subdirectories with regular expression for version
	const gccContainingUri = uriTools.pathJoin(asVersion.baseUri, 'AS/gnuinst');
	const gccSubDirs       = await uriTools.listSubDirectoryNames(gccContainingUri);
	const gccDirRegExp     = new RegExp('^V(\\d+).(\\d+).(\\d+)$');
	const matching         = gccSubDirs.filter(d => gccDirRegExp.test(d)).map(d => gccDirRegExp.exec(d));
	// create version information from matching subdirectories
	for (const match of matching) {
		const gccVersionUri = uriTools.pathJoin(gccContainingUri, match![0]);
		const version    = semver.coerce(match![0]);
		if (!version) {
			Logger.default.warning('Cannot create semantic version for URI: ' + gccVersionUri.fsPath);
			continue;
		}
		//HACK from AS V >= 4.9 there is an additional subfolder '4.9' -> do it properly with regex, so future versions can be handled
		const gccUriAs49 = uriTools.pathJoin(gccVersionUri, '4.9');
		const newGccPathScheme = await uriTools.exists(gccUriAs49);
		const finalGccUri = newGccPathScheme ? gccUriAs49 : gccVersionUri;
		// create gcc version object and push
		const gccVersion: AsGccVersionInfo =
		{
			baseUri: finalGccUri,
			version: version,
			targetSystemData: {}
		};
		findAvailableGccTargetSystems(gccVersion);
		asVersion.gccVersions.push(gccVersion);
	}

	asVersion.gccVersions.push();
	// sort
	asVersion.gccVersions.sort((a, b) => semver.compare(a.version, b.version));
}


/**
 * Searches for gcc installations within gccVersion.baseUri and sets all found versions to gccVersion.targetSystemData
 * @param gccVersion gcc version info for which target systems are searched. gccVersion.targetSystemData is modified by this function
 */
async function findAvailableGccTargetSystems(gccVersion: AsGccVersionInfo): Promise<void> {
	// clear existing data
	for (const key in gccVersion.targetSystemData) {
		delete gccVersion.targetSystemData[key];
	}
	// setting of compiler exe and includes. Currently hard coded, because structures and folder names differ on each gcc version
	//TODO find a more generic solution
	const gccUri = gccVersion.baseUri;
	// gcc V4.1.2
	if (gccVersion.version.compare('4.1.2') === 0) {
		// SG4 Ia32
		gccVersion.targetSystemData['SG4 Ia32'] = {
			//gccExe:                uriTools.pathJoin(gccUri, 'bin/i386-elf-gcc.exe'), // i386 gcc V4.1.2 does not support query from C/C++ extension
			gccExe:                uriTools.pathJoin(gccUri, 'bin/arm-elf-gcc.exe')
		};
		// SG4 Arm
		gccVersion.targetSystemData['SG4 Arm'] = {
			gccExe:                uriTools.pathJoin(gccUri, 'bin/arm-elf-gcc.exe')
		};
	}
	// gcc V6.3.0
	if (gccVersion.version.compare('6.3.0') === 0) {
		// SG4 Ia32
		gccVersion.targetSystemData['SG4 Ia32'] = {
			gccExe:                uriTools.pathJoin(gccUri, 'bin/i686-elf-gcc.exe')
		};
		// SG4 Arm
		gccVersion.targetSystemData['SG4 Arm'] = {
			gccExe:                uriTools.pathJoin(gccUri, 'bin/arm-eabi-gcc.exe')
		};
	}
}


/**
 * Searches for PVI installations within the configured installation paths. Search is not recursive!
 */
async function findAvailablePviVersions(): Promise<PviVersionInfo[]> {
	const baseInstallUris = extensionConfiguration.environment.pviInstallPaths;
	const versionInfos: PviVersionInfo[] = [];
	for (const uri of baseInstallUris) {
		versionInfos.push(...(await findAvailablePviVersionsInUri(uri)));
	}
	// sort by version
	versionInfos.sort((a, b) => semver.compare(b.version, a.version));
	return versionInfos;
}


async function findAvailablePviVersionsInUri(uri: vscode.Uri): Promise<PviVersionInfo[]> {
	const versionInfos: PviVersionInfo[] = [];
	// filter subdirectories with regular expression for AS version
	const subDirectoryNames = await uriTools.listSubDirectoryNames(uri);
	for (const subDirectoryName of subDirectoryNames) {
		const versionBaseUri = uriTools.pathJoin(uri, subDirectoryName);
		// find PVITransfer.exe candidates and select first
		const pviTransferExecutables: vscode.Uri[] = [];
		const transferExeAsInstall = uriTools.pathJoin(versionBaseUri, 'PVI/Tools/PVITransfer/PVITransfer.exe'); // Standard installation path for AS installation
		if (await uriTools.exists(transferExeAsInstall)) {
			pviTransferExecutables.push(transferExeAsInstall);
		}
		const transferExeRucExport = uriTools.pathJoin(versionBaseUri, 'PVITransfer.exe'); // Directly in directory (e.g. by RUC export)
		if (await uriTools.exists(transferExeRucExport)) {
			pviTransferExecutables.push(transferExeRucExport);
		}
		if (pviTransferExecutables.length === 0) {
			// much slower backup solution which searches recursive
			pviTransferExecutables.push(...await vscode.workspace.findFiles({base: versionBaseUri.fsPath, pattern: '**/PVITransfer.exe'}));
			if (pviTransferExecutables.length === 0) {
				Logger.default.warning(`Cannot find PVITransfer.exe in URI: ${versionBaseUri.fsPath}`);
				continue;
			}
		}
		const pviTransferExecutable = pviTransferExecutables[0];
		// get version from exe
		const pviTransferVersion = semver.coerce(subDirectoryName);
		if (!pviTransferVersion) {
			Logger.default.warning(`Cannot get version of ${pviTransferExecutable.fsPath}`);
			continue;
		}
		Logger.default.info(`PVI Version V${pviTransferVersion.version} found in ${versionBaseUri.fsPath}`);
		// create version information and push to array
		const versionInfo: PviVersionInfo = {
			version:        pviTransferVersion,
			baseUri:        versionBaseUri,
			pviTransferExe: pviTransferExecutable
		};
		versionInfos.push(versionInfo);
	}
	return versionInfos;
}


//#endregion local functions
