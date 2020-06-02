import * as vscode from 'vscode';
import * as Helpers from './Helpers';
import * as BRConfiguration from './BRConfiguration';


/**
 * Gets all available Automation Studio versions from 'C:/BrAutomation'
 */
export async function getAvailableAutomationStudioVersions() {
	// TODO get base path from configuration or function parameter instead of constant 'C:/BrAutomation'
	// list subdirectories and filter with RegExp
	const baseInstallPath = 'C:/BrAutomation';
	const baseInstallUri: vscode.Uri = vscode.Uri.file(baseInstallPath);
	const subDirectories = await Helpers.listDirectories(baseInstallUri);
	const asDirRegExp = new RegExp(/^AS(\d)(\d)(\d*)$/);
	const matching = subDirectories.filter(d => asDirRegExp.test(d)).map(d => asDirRegExp.exec(d));
	// create basic version info from matches
	const versions = new Array<BRConfiguration.AsVersionInformation>();
	for (const match of matching) {
		const version: BRConfiguration.AsVersionInformation =
		{
			version: 'V' + match![1] + '.' + match![2],
			installPath: baseInstallPath + '/' + match![0] + '/',
			gccVersions: new Array<BRConfiguration.AsGccVersionInformation>()
		};
		versions.push(version);
	}
	// get gcc version information for AS versions
	for (const version of versions) {
		await getAvailableGccVersions(version);
	}
	return versions;
}

/**
 * Searches for gcc installations within versionInfo.installPath and pushes all found versions to versionInfo.gccVersions
 * @param versionInfo AS version info for which gcc versions are searched. versionInfo.gccVersions is modified by this function
 */
async function getAvailableGccVersions(versionInfo: BRConfiguration.AsVersionInformation) {
	//TODO instead of using fixed relative path to AS installation, maybe find gcc.exe -> will be more flexible for changing folder structure
	// list subdirectories of AS indtallation folder and match gcc folders with RegExp
	const asUri = vscode.Uri.file(versionInfo.installPath);
	const gccBaseUri = Helpers.appendUri(asUri, 'AS/gnuinst', true);
	const gccSubDirs = await Helpers.listDirectories(gccBaseUri);
	const gccDirRegExp = new RegExp('^V(\\d+).(\\d+).(\\d+)$');
	const matching = gccSubDirs.filter(d => gccDirRegExp.test(d)).map(d => gccDirRegExp.exec(d));
	// create gcc version info from matches
	for (const match of matching) {
		const gccVersionUri = Helpers.appendUri(gccBaseUri, match![0], true);
		const asPath = asUri.fsPath;
		const gccVersionPath = gccVersionUri.fsPath;
		let gccRelativePath = gccVersionPath.replace(asPath, '');
		gccRelativePath = vscode.Uri.file(gccRelativePath).path;// Workaround: Uri.fspath is used for replace to avoid case sensitivity issues with Uri.path
		const gccVersion: BRConfiguration.AsGccVersionInformation =
		{
			version: match![0],
			automationStudioRelativePath: gccRelativePath
		};
		versionInfo.gccVersions.push(gccVersion);
	}
	return;
}