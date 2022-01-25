import * as vscode from 'vscode';
import { logger } from '../BrLog';
import * as uriTools from '../Tools/UriTools';
import * as semver from 'semver';
import { PviTransferExe } from './PviTransferExe';

/**
 * Representation of a PVI (Process Variable Interface) version
 */
export class PviVersion {

    /**
     * Gets all PVI versions which are located in the rootUri.
     * @param installRoot The root directory containing multiple PVI installations. e.g. `C:\BrAutomation\PVI`
     * @returns An array with all found versions
     */
    public static async searchVersionsInDir(installRoot: vscode.Uri): Promise<PviVersion[]> {
        // Get matching subdirectories
        const pviDirRegExp = /^V[\d]+\.[\d\.]+$/;
        const subDirs = await uriTools.listSubDirectories(installRoot, pviDirRegExp);
        // create PviVersion from from matching subdirectories
        const versions: PviVersion[] = [];
        for (const dir of subDirs) {
            const pviVersion = await this.createFromDir(dir);
            if (pviVersion) {
                versions.push(pviVersion);
            }
        }
        //done
        return versions;
    }

    /**
     * Creates a PVI version from a specified root directory
     * @param pviRoot The root directory containing a single PVI installation. e.g. `C:\BrAutomation\PVI\V4.10`
     * @returns The version which was parsed from the root URI
     */
    public static async createFromDir(pviRoot: vscode.Uri): Promise<PviVersion | undefined> {
        // Create and initialize object
        try {
            const pvi = new PviVersion(pviRoot);
            await pvi.#initialize();
            logger.info(`PVI Version V${pvi.version.version} found in '${pvi.rootPath.fsPath}'`);
            return pvi;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to get PVI in path '${pviRoot.fsPath}': ${error.message}`);
            } else {
                logger.error(`Failed to get PVI in path '${pviRoot.fsPath}'`);
            }
            return undefined;
        }
    }

    /** Object is not ready to use after constructor due to async operations,
     * #initialize() has to be called for the object to be ready to use! */
    private constructor(pviRoot: vscode.Uri) {
        this.#rootPath = pviRoot;
        // other properties rely on async and will be initialized in #initialize()
    }

    /** Async operations to finalize object construction */
    async #initialize() {
        this.#version = await parsePviVersion(this.#rootPath);
        // Find PVITransfer.exe
        this.#pviTransfer = await searchPviTransferExe(this.#rootPath);
        if (!this.#pviTransfer) {
            throw new Error('Cannot find PVITransfer.exe');
        }
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** The root URI of the PVI version */
    public get rootPath(): vscode.Uri {
        if (!this.#isInitialized) { throw new Error('Use of not initialized Pvi object'); }
        return this.#rootPath;
    }
    #rootPath: vscode.Uri;

    /** The version of the PVI */
    public get version(): semver.SemVer {
        if (!this.#isInitialized || !this.#version) { throw new Error('Use of not initialized Pvi object'); }
        return this.#version;
    }
    #version: semver.SemVer | undefined;

    /** PVITransfer.exe of this PVI version */
    public get pviTransfer(): PviTransferExe {
        if (!this.#isInitialized || !this.#pviTransfer) { throw new Error('Use of not initialized Pvi object'); }
        return this.#pviTransfer;
    }
    #pviTransfer: PviTransferExe | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            rootPath: this.rootPath.toString(true),
            version: this.version.version,
            pviTransfer: this.#pviTransfer,
        };
    }
}

/**
 * Trys to parse the version if a PVI installation. The info is gathered from the rootPath name.
 * @param pviRoot Root path of the PVI installation. e.g. `C:\BrAutomation\PVI\V4.8`
 * @returns The parsed version, or V0.0.0 if parsing failed
 */
async function parsePviVersion(pviRoot: vscode.Uri): Promise<semver.SemVer> {
    let version: semver.SemVer | undefined = undefined;
    // Try parse version from root directory name
    const dirName = uriTools.pathBasename(pviRoot);
    version = semver.coerce(dirName) ?? undefined;
    if (version) {
        return version;
    } else {
        logger.warning(`Failed to parse PVI Version from directory name '${pviRoot.toString(true)}'. PVI will be listed as V0.0.0`);
    }
    // set to V0.0.0 as backup, so PVI is still available but with wrong version...
    return new semver.SemVer('0.0.0');
}

/**
 * Search for PVITransfer.exe in the PVI installation
 * @param pviRoot Root path of the PVI installation. e.g. `C:\BrAutomation\PVI\V4.8`
 * @returns The first found PVITransfer.exe, or `undefined` if no such was found.
 */
async function searchPviTransferExe(pviRoot: vscode.Uri): Promise<PviTransferExe | undefined> {
    // Standard installation path for AS or separate PVI installation
    const transferExeAsInstall = vscode.Uri.joinPath(pviRoot, 'PVI/Tools/PVITransfer/PVITransfer.exe'); // Standard installation path for AS installation
    if (await uriTools.exists(transferExeAsInstall)) {
        return new PviTransferExe(transferExeAsInstall);
    }
    // Directly in root directory (e.g. by RUC export)
    const transferExeRucExport = vscode.Uri.joinPath(pviRoot, 'PVITransfer.exe');
    if (await uriTools.exists(transferExeRucExport)) {
        return new PviTransferExe(transferExeRucExport);
    }
    // slower search if none was found yet
    const searchPattern = new vscode.RelativePattern(pviRoot, '**/PVITransfer.exe');
    const searchResult = await vscode.workspace.findFiles(searchPattern);
    if (searchResult.length > 0) {
        return new PviTransferExe(searchResult[0]);
    }
    // none was found
    return undefined;
}