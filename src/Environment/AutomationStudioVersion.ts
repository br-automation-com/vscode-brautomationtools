import * as vscode from 'vscode';
import * as uriTools from '../Tools/UriTools';
import * as semver from 'semver';
import { logger } from '../Tools/Logger';
import { GccInstallation } from './GccInstallation';
import { BrAsBuildExe } from './BrAsBuildExe';

/**
 * Representation of an Automation Studio version
 */
export class AutomationStudioVersion {

    /**
     * Gets all Automation Studio versions which are located in the installRoot.
     * @param installRoot The root directory containing multiple Automation Studio installations. e.g. `C:\BrAutomation`
     * @returns An array with all found versions
     */
    public static async searchVersionsInDir(installRoot: vscode.Uri): Promise<AutomationStudioVersion[]> {
        // Get matching subdirectories
        const asDirRegExp = /^AS(\d)(\d+)$/;
        const subDirs = await uriTools.listSubDirectories(installRoot, asDirRegExp);
        // create AutomationStudioVersion from matching subdirectories
        const versions: AutomationStudioVersion[] = [];
        for (const dir of subDirs) {
            const asVersion = await this.createFromDir(dir);
            if (asVersion !== undefined) {
                versions.push(asVersion);
            }
        }
        // done
        return versions;
    }

    /**
     * Creates an Automation Studio version from a specified root directory
     * @param asRoot The root directory containing a single Automation Studio installation. e.g. `C:\BrAutomation\AS410`
     * @returns The version which was parsed from the root URI
     */
    public static async createFromDir(asRoot: vscode.Uri): Promise<AutomationStudioVersion | undefined> {
        // Create and initialize object
        try {
            const asVersion = new AutomationStudioVersion(asRoot);
            await asVersion.#initialize();
            logger.info(`Automation Studio Version V${asVersion.version.version} found in ${logger.formatUri(asVersion.rootPath)}.`);
            return asVersion;
        } catch (error) {
            logger.error(`Failed to get Automation Studio in path ${logger.formatUri(asRoot)}. ${logger.formatError(error)}`);
            return undefined;
        }
    }

    /** Object is not ready to use after constructor due to async operations,
     * #initialize() has to be called for the object to be ready to use! */
    private constructor(asRoot: vscode.Uri) {
        this.#rootPath = asRoot;
        // other properties rely on async and will be initialized in #initialize()
    }

    /** Async operations to finalize object construction */
    async #initialize(): Promise<void> {
        this.#version = await parseAutomationStudioVersion(this.#rootPath);
        // Find BR.AS.Build.exe
        this.#buildExe = await searchAutomationStudioBuildExe(this.#rootPath);
        if (!this.#buildExe) {
            throw new Error('Cannot find BR.AS.Build.exe');
        }
        // find gcc versions
        const gccInstallRoot = vscode.Uri.joinPath(this.#rootPath, './AS/gnuinst');
        this.#gccInstallation = await GccInstallation.searchAutomationStudioGnuinst(gccInstallRoot);
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** The root URI of the Automation Studio version */
    public get rootPath(): vscode.Uri {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized ${AutomationStudioVersion.name} object`); }
        return this.#rootPath;
    }
    #rootPath: vscode.Uri;

    /** The Automation Studio version */
    public get version(): semver.SemVer {
        if (!this.#isInitialized || !this.#version) { throw new Error(`Use of not initialized ${AutomationStudioVersion.name} object`); }
        return this.#version;
    }
    #version: semver.SemVer | undefined;

    /** The Automation Studio project build tool */
    public get buildExe(): BrAsBuildExe {
        if (!this.#isInitialized || !this.#buildExe) { throw new Error(`Use of not initialized ${AutomationStudioVersion.name} object`); }
        return this.#buildExe;
    }
    #buildExe: BrAsBuildExe | undefined;

    /** gcc compiler versions available in this Automation Studio version */
    public get gccInstallation(): GccInstallation {
        if (!this.#isInitialized || !this.#gccInstallation) { throw new Error(`Use of not initialized ${AutomationStudioVersion.name} object`); }
        return this.#gccInstallation;
    }
    #gccInstallation: GccInstallation | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): Record<string, unknown> {
        return {
            rootPath: this.rootPath.toString(true),
            version: this.version.version,
            buildExe: this.buildExe,
            gccInstallation: this.gccInstallation,
        };
    }
}

/**
 * Trys to parse the version if an Automation Studio installation. The info is gathered from info files and the rootPath name.
 * @param asRoot Root path of the AS installation. e.g. `C:\BrAutomation\AS410`
 * @returns The parsed version, or V0.0.0 if parsing failed
 */
async function parseAutomationStudioVersion(asRoot: vscode.Uri): Promise<semver.SemVer> {
    let version: semver.SemVer | undefined = undefined;
    // Try to get version from ./BrSetup/VInfo/ProductInfo_bin-en.brv or ./BrSetup/VInfo/ProductInfo_bin-de.brv
    // -> Depending on installed languages both or only one may exist
    // -> In older AS versions bin was written in caps (Bin)
    const prodInfoBasePath = uriTools.pathJoin(asRoot, 'BrSetup/VInfo');
    const prodInfoPathEn = uriTools.pathJoin(prodInfoBasePath, 'ProductInfo_bin-en.brv');
    const prodInfoPathEnOld = uriTools.pathJoin(prodInfoBasePath, 'ProductInfo_Bin-en.brv');
    const prodInfoPathDe = uriTools.pathJoin(prodInfoBasePath, 'ProductInfo_bin-de.brv');
    const prodInfoPathDeOld = uriTools.pathJoin(prodInfoBasePath, 'ProductInfo_Bin-de.brv');
    const prodInfoPath = await uriTools.exists(prodInfoPathEn) ? prodInfoPathEn
        : await uriTools.exists(prodInfoPathDe) ? prodInfoPathDe
            : await uriTools.exists(prodInfoPathEnOld) ? prodInfoPathEnOld
                : await uriTools.exists(prodInfoPathDeOld) ? prodInfoPathDeOld
                    : undefined;
    if (prodInfoPath !== undefined) {
        try {
            const prodInfoDoc = await vscode.workspace.openTextDocument(prodInfoPath);
            const prodInfoText = prodInfoDoc.getText();
            const versionRegex = /^\.\\pg\.exe\s*([\d.]+)/m;
            const versionMatch = versionRegex.exec(prodInfoText);
            if (versionMatch) {
                version = semver.coerce(versionMatch[0]) ?? undefined;
            }
        } catch (error) {
            // no reaction required
        }
    }
    if (version !== undefined) {
        return version;
    } else {
        logger.warning(`Failed to find AS Version information within ${logger.formatUri(prodInfoBasePath)}. Will try to parse version approximation from directory name`);
    }
    // Try parse version from root directory name if get from file failed
    const dirName = uriTools.pathBasename(asRoot);
    const asDirRegExp = /^AS(\d)(\d+)$/;
    const match = asDirRegExp.exec(dirName);
    if (match && match.length >= 3) {
        version = semver.coerce(`${match[1]}.${match[2]}.0`) ?? undefined;
    }
    if (version) {
        return version;
    } else {
        logger.warning(`Failed to parse AS Version from directory name ${logger.formatUri(asRoot)}. AS will be listed as V0.0.0`);
    }
    // set to V0.0.0 as backup, so AS is still available but with wrong version...
    return new semver.SemVer('0.0.0');
}

/**
 * Search for Br.As.Build.exe in the Automation Studio installation
 * @param asRoot Root path of the AS installation. e.g. `C:\BrAutomation\AS410`
 * @returns The first found Br.As.Build.exe, or undefined if no such was found.
 */
async function searchAutomationStudioBuildExe(asRoot: vscode.Uri): Promise<BrAsBuildExe | undefined> {
    // english
    const buildExeUriEn = uriTools.pathJoin(asRoot, 'Bin-en/BR.AS.Build.exe');
    if (await uriTools.exists(buildExeUriEn)) {
        return new BrAsBuildExe(buildExeUriEn);
    }
    // german
    const buildExeUriDe = uriTools.pathJoin(asRoot, 'Bin-de/BR.AS.Build.exe');
    if (await uriTools.exists(buildExeUriDe)) {
        return new BrAsBuildExe(buildExeUriDe);
    }
    // slower search if none was found yet
    const searchPattern = new vscode.RelativePattern(asRoot, '**/BR.AS.Build.exe');
    const searchResult = await vscode.workspace.findFiles(searchPattern);
    if (searchResult.length > 0) {
        return new BrAsBuildExe(searchResult[0]);
    }
    // none was found
    return undefined;
}