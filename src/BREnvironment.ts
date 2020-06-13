import * as vscode from 'vscode';
import * as BRConfiguration from './BRConfiguration';
import * as uriTools from './Tools/UriTools';
import * as semver from 'semver';
import { type } from 'os';

//#region exported interfaces
//TODO get version information once on startup, only specify an array of base install paths in the configuration

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
	brAsBuildExe: vscode.Uri;
    gccVersions: Array<AsGccVersionInfo>;
}

/**
 * Information of gcc installation within B&R Automation Studio
 */
export interface AsGccVersionInfo extends VersionInfo  {
	targetSystemData: {
		[targetSystem: string]: AsGccTargetSystemInfo
	}
}

/**
 * Target system types in notation '<target> <hardware architecture>'
 */
//TODO maybe use for AsGccVersionInfo.targetSystemData[targetSystem: TargetSystemType], but it gives errors
export type TargetSystemType = 'SG3 M68k' | 'SGC M68k' | 'SG4 Ia32' | 'SG4 Arm';

export interface AsGccTargetSystemInfo {
	gccExe: vscode.Uri;
	cStandardIncludePaths: vscode.Uri[];
}
//#endregion exported interfaces

//#region local variables
/** Array of all available AS versions. The array is sorted, so that the highest version is always the first array element */
//TODO put functionality in a class to save state, or are local variables like this OK?
let _availableAutomationStudioVersions: Promise<ASVersionInfo[]> = findAvailableASVersions();
//#endregion local variables

//#region exported functions
/**
 * Gets all available Automation Studio versions from 'C:/BrAutomation'. Ther versions are sorted, so the first entry contains the highest version.
 */
export async function getAvailableAutomationStudioVersions(): Promise<ASVersionInfo[]> {
	return await _availableAutomationStudioVersions;
}

export async function updateAvailableAutomationStudioVersions(): Promise<void> {
	_availableAutomationStudioVersions = findAvailableASVersions();
	//TODO call when configuration value of baseInstallPaths changes
	const versionInfos = await _availableAutomationStudioVersions;
	if (versionInfos.length === 0) {
		const messageItems = ['Change baseInstallPaths'];
		vscode.window.showWarningMessage('No Automation Studio versions found. Build functionality will not be available.', ...messageItems);
		return;
	}
	vscode.window.showInformationMessage(`${versionInfos.length} Automation Studio versions found`);
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
//#endregion exported functions

//#region local functions
async function findAvailableASVersions(): Promise<ASVersionInfo[]> {
	const baseInstallUris = BRConfiguration.getAutomationStudioInstallPaths();
	const versionInfos: ASVersionInfo[] = [];
	for (const uri of baseInstallUris) {
		versionInfos.push(...(await findAvailableASVersionsInUri(uri)));
	}
	// sort by version
	versionInfos.sort((a, b) => semver.compare(b.version, a.version));
	return versionInfos;
}

async function findAvailableASVersionsInUri(uri: vscode.Uri): Promise<ASVersionInfo[]> {
	// filter subdirectories with regular expression for AS version
	const subDirectories = await uriTools.listSubDirectoryNames(uri);
	const asDirRegExp = new RegExp(/^AS(\d)(\d)(\d*)$/);
	const matching = subDirectories.filter(d => asDirRegExp.test(d)).map(d => asDirRegExp.exec(d));
	// create version information from matching subdirectories
	const versionInfos: ASVersionInfo[] = [];
	for (const match of matching) {
		// create full URI
		const versionBaseUri = uriTools.pathJoin(uri, match![0]);
		// create semantic version
		const version = semver.coerce(`${match![1]}.${match![2]}.${match![3]}`);
		if (!version) {
			console.error('Cannot create semantic version for URI: ' + versionBaseUri.fsPath);
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
				console.warn(`Cannot find BR.AS.Build.exe in URI: ${versionBaseUri.fsPath}`);
				continue;
			}
		}
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
		const versionBaseUri = uriTools.pathJoin(gccContainingUri, match![0]);
		const version        = semver.coerce(match![0]);
		if (!version) {
			console.warn('Cannot create semantic version for URI: ' + versionBaseUri.fsPath);
			continue;
		}
		const gccVersion: AsGccVersionInfo =
		{
			baseUri: versionBaseUri,
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
	// following include paths are required (example SG4 Ia32):
	//     cStandardIncludePaths: [
	//         uriTools.pathJoin(gccUri, 'i386-elf/include/'),              --> required for most system headers and B&R specific bur/plc.h...
	//         uriTools.pathJoin(gccUri, 'lib/gcc/i386-elf/4.1.2/include/') --> required for some system headers, e.g. stddef.h, stdbool.h
	//     ]
	// another solution might be searching for plc.h and stddef.h to get the header locations automatically
	//TODO Find which gcc.exe is the right one. Maybe by selecting the right gcc.exe, C/C++ extension can find the system includes without defining
	const gccUri = gccVersion.baseUri;
	// gcc V2.95.3
	if (gccVersion.version.compare('2.95.3') === 0) {
		// SG3 M68k
		gccVersion.targetSystemData['SG3 M68k'] = {
			gccExe:                uriTools.pathJoin(gccUri, 'bin/m68k-elf-gcc.exe'),
			cStandardIncludePaths: [
				uriTools.pathJoin(gccUri, 'm68k-elf/include/'),
				uriTools.pathJoin(gccUri, 'lib/gcc-lib/m68k-elf/2.95.3/include/')
			]
		};
		// SGC M68k
		gccVersion.targetSystemData['SGC M68k'] = {
			gccExe:                uriTools.pathJoin(gccUri, 'bin/m68k-elf-gcc.exe'),
			cStandardIncludePaths: [
				uriTools.pathJoin(gccUri, 'm68k-elf/include/'),
				uriTools.pathJoin(gccUri, 'lib/gcc-lib/m68k-elf/2.95.3/include/')
			]
		};
		// SG4 Ia32
		gccVersion.targetSystemData['SG4 Ia32'] = {
			gccExe:                uriTools.pathJoin(gccUri, 'bin/i386-elf-gcc.exe'),
			cStandardIncludePaths: [
				uriTools.pathJoin(gccUri, 'i386-elf/include/'),
				uriTools.pathJoin(gccUri, 'lib/gcc-lib/i386-elf/2.95.3/include/')
			]
		};
	}
	// gcc V4.1.2
	if (gccVersion.version.compare('4.1.2') === 0) {
		// SG4 Ia32
		gccVersion.targetSystemData['SG4 Ia32'] = {
			gccExe:                uriTools.pathJoin(gccUri, 'bin/i386-elf-gcc.exe'),
			cStandardIncludePaths: [
				uriTools.pathJoin(gccUri, 'i386-elf/include/'),
				uriTools.pathJoin(gccUri, 'lib/gcc/i386-elf/4.1.2/include/')
			]
		};
		// SG4 Arm
		gccVersion.targetSystemData['SG4 Arm'] = {
			gccExe:                uriTools.pathJoin(gccUri, 'bin/arm-elf-gcc.exe'),
			cStandardIncludePaths: [
				uriTools.pathJoin(gccUri, 'arm-elf/include/'),
				uriTools.pathJoin(gccUri, 'lib/gcc/arm-elf/4.1.2/include/')
			]
		};
	}
	// gcc V6.3.0
	if (gccVersion.version.compare('6.3.0') === 0) {
		// SG4 Ia32
		gccVersion.targetSystemData['SG4 Ia32'] = {
			gccExe:                uriTools.pathJoin(gccUri, 'bin/i686-elf-gcc.exe'),
			cStandardIncludePaths: [
				uriTools.pathJoin(gccUri, 'i686-elf/include/'),
				uriTools.pathJoin(gccUri, 'lib/gcc/i686-elf/6.3.0/include')
			]
		};
		// SG4 Arm
		gccVersion.targetSystemData['SG4 Arm'] = {
			gccExe:                uriTools.pathJoin(gccUri, 'bin/arm-eabi-gcc.exe'),
			cStandardIncludePaths: [
				uriTools.pathJoin(gccUri, 'arm-eabi/include/'),
				uriTools.pathJoin(gccUri, 'lib/gcc/arm-eabi/6.3.0/include')
			]
		};
	}
}
//#endregion local functions