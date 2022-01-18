/**
 * Handling of installed PVI versions on the developer PC
 * @packageDocumentation
*/

import * as vscode from 'vscode';
import { logger } from '../BrLog';
import * as uriTools from '../Tools/UriTools';
import * as semver from 'semver';
import { extensionConfiguration } from '../BRConfiguration';
import { PviTransferExe } from './PviTransferExe';
import { requestVersion } from './SemVerTools';


export class Pvi {

    // static getters, updaters for queries

    /**
     * Get all available PVI versions
     * @returns All available PVI versions
     */
    static async getPviVersions(): Promise<Pvi[]> {
        if (this.#pviVersions === undefined) {
            this.#pviVersions = this.#searchPviVersions();
        }
        return this.#pviVersions;
    }


    /**
     * Get a specific Pvi version object. If used in non strict mode, the highest available version will be returned.
     * @param versionRequest The requested version which should be prefered. Can be set to `undefined` if any version is ok
     * @param strict Only return a Pvi with same major.minor version. Defaults to `false`
     * @returns A `Pvi` version which fullfills the request or `undefined` if no such version was found
     */
    static async getPviVersion(requested?: semver.SemVer | string, strict = false): Promise<Pvi | undefined> {
        const versions = await this.getPviVersions();
        return requestVersion(versions, requested, strict);
    }


    /**
     * Starts a new search for PVI versions in the configured directories and updates the internal store.
     * @returns All available PVI versions after update
     */
    static async updatePviVersions(): Promise<Pvi[]> {
        this.#pviVersions = this.#searchPviVersions();
        return this.#pviVersions;
    }


    static #pviVersions: Promise<Pvi[]> | undefined;


    /** Searches for PVI versions in all configured directores */
    static async #searchPviVersions(): Promise<Pvi[]> {
        const result = [];
        logger.info('Start searching for PVI versions');
        const configuredDirs = extensionConfiguration.environment.pviInstallPaths;
        for (const configDir of configuredDirs) {
            logger.info(`Searching for PVI versions in '${configDir.fsPath}'`);
            const subDirs = await uriTools.listSubDirectories(configDir);
            for (const subDir of subDirs) {
                const version = await this.#createFromDir(subDir);
                if (version) {
                    result.push(version);
                }
            }
        }
        logger.info(`Searching for PVI versions done, ${result.length} versions found`);
        return result;
    }


    /** Creates a PVI version from a specified root directory */
    static async #createFromDir(rootUri: vscode.Uri): Promise<Pvi | undefined> {
        // parse version from directory name
        const dirName = uriTools.pathBasename(rootUri);
        const parsedVersion = semver.coerce(dirName);
        if (!parsedVersion) {
            logger.debug("Pvi.#createFromDir(uri) -> couldn't parse SemVer, subDir skipped", { uri: rootUri.toString(true), subDir: dirName });
            return undefined;
        }
        // Create and initialize object
        try {
            const pvi = new Pvi(rootUri, parsedVersion);
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


    private constructor(rootUri: vscode.Uri, parsedVersion: semver.SemVer) {
        // cannot fully initialize in constructor, as async operations are required.
        // always await #initialize so the object is ready to use!
        this.#rootUri = rootUri;
        this.#version = parsedVersion;
    }

    
    /** The root URI of the PVI version */
    public get rootUri(): vscode.Uri {
        //TODO FATAL log entry in all these cases...
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


    public get pviTransfer(): PviTransferExe {
        if (!this.#isInitialized) { throw new Error('Use of not initialized Pvi object'); }
        return this.#pviTransfer!;
    }
    #pviTransfer: PviTransferExe | undefined;


    async #initialize() {
        // find PVITransfer.exe candidates and select first
        const pviTransferExecutables: vscode.Uri[] = [];
        const transferExeAsInstall = uriTools.pathJoin(this.#rootUri, 'PVI/Tools/PVITransfer/PVITransfer.exe'); // Standard installation path for AS installation
        if (await uriTools.exists(transferExeAsInstall)) {
            pviTransferExecutables.push(transferExeAsInstall);
        }
        const transferExeRucExport = uriTools.pathJoin(this.#rootUri, 'PVITransfer.exe'); // Directly in directory (e.g. by RUC export)
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
}