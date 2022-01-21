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
     * @param rootUri The root directory containing multiple PVI installations. e.g. `C:\BrAutomation\PVI`
     * @returns An array with all found versions
     */
    public static async searchVersionsInDir(rootUri: vscode.Uri): Promise<PviVersion[]> {
        // create PviVersion from all subdirectories
        const result: PviVersion[] = [];
        const subDirs = await uriTools.listSubDirectories(rootUri);
        for (const subDir of subDirs) {
            const version = await this.createFromDir(subDir);
            if (version) {
                result.push(version);
            }
        }
        //done
        return result;
    }

    /**
     * Creates a PVI version from a specified root directory
     * @param rootUri The root directory containing a single PVI installation. e.g. `C:\BrAutomation\PVI\V4.10`
     * @returns The version which was parsed from the root URI
     */
    public static async createFromDir(rootUri: vscode.Uri): Promise<PviVersion | undefined> {
        // Create and initialize object
        try {
            const pvi = new PviVersion(rootUri);
            await pvi.#initialize();
            logger.info(`PVI Version V${pvi.version.version} found in '${pvi.rootUri.fsPath}'`);
            return pvi;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to get PVI in path '${rootUri.fsPath}': ${error.message}`);
            } else {
                logger.error(`Failed to get PVI in path '${rootUri.fsPath}'`);
            }
            return undefined;
        }
    }

    /** Object is not ready to use after constructor due to async operations,
     * #initialize() has to be called for the object to be ready to use! */
    private constructor(rootUri: vscode.Uri) {
        this.#rootUri = rootUri;
        // parse version from directory name
        const dirName = uriTools.pathBasename(this.#rootUri);
        const version = semver.coerce(dirName);
        if (!version) {
            throw new Error('Cannot parse version from directory name');
        }
        this.#version = version;
        // other properties rely on async and will be initialized in #initialize()
    }

    /** Async operations to finalize object construction */
    async #initialize() {
        // find PVITransfer.exe candidates and select first
        const pviTransferExecutables: vscode.Uri[] = [];
        const transferExeAsInstall = vscode.Uri.joinPath(this.#rootUri, './PVI/Tools/PVITransfer/PVITransfer.exe'); // Standard installation path for AS installation
        if (await uriTools.exists(transferExeAsInstall)) {
            pviTransferExecutables.push(transferExeAsInstall);
        }
        const transferExeRucExport = vscode.Uri.joinPath(this.#rootUri, './PVITransfer.exe'); // Directly in directory (e.g. by RUC export)
        if (await uriTools.exists(transferExeRucExport)) {
            pviTransferExecutables.push(transferExeRucExport);
        }
        if (pviTransferExecutables.length === 0) {
            // much slower backup solution which searches recursive
            pviTransferExecutables.push(...await vscode.workspace.findFiles({ base: this.#rootUri.fsPath, pattern: '**/PVITransfer.exe' }));
            if (pviTransferExecutables.length === 0) {
                throw new Error('Cannot find PVITransfer.exe');
            }
        }
        this.#pviTransfer = new PviTransferExe(pviTransferExecutables[0]);
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** The root URI of the PVI version */
    public get rootUri(): vscode.Uri {
        if (!this.#isInitialized) { throw new Error('Use of not initialized Pvi object'); }
        return this.#rootUri;
    }
    #rootUri: vscode.Uri;

    /** The version of the PVI */
    public get version(): semver.SemVer {
        if (!this.#isInitialized) { throw new Error('Use of not initialized Pvi object'); }
        return this.#version;
    }
    #version: semver.SemVer;

    /** PVITransfer.exe of this PVI version */
    public get pviTransfer(): PviTransferExe {
        if (!this.#isInitialized) { throw new Error('Use of not initialized Pvi object'); }
        return this.#pviTransfer!;
    }
    #pviTransfer: PviTransferExe | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            rootUri: this.rootUri.toString(true),
            version: this.version.version,
            pviTransfer: this.#pviTransfer,
        };
    }
}