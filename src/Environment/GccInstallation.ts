import * as vscode from 'vscode';
import * as uriTools from '../Tools/UriTools';
import * as semver from 'semver';
import { logger } from '../Tools/Logger';
import { SystemGeneration, TargetArchitecture } from './CommonTypes';
import { GccExecutable } from './GccExecutable';

/**
 * Representation of a gcc installation
 */
export class GccInstallation {

    /**
     * Gets all gcc executables which are located in the Automation Studio `gnuinst` directory
     * @param root The Automation Studio `gnuinst` directory containing multiple gcc installations. e.g. `C:\BrAutomation\AS410\AS\gnuinst`
     * @returns The installation with all found *gcc.exe
     */
    public static async searchAutomationStudioGnuinst(root: vscode.Uri): Promise<GccInstallation> {
        // create gcc installation from all matching directories
        const gccDirRegExp = /^V(\d+).(\d+).(\d+)$/;
        const rootUris = await uriTools.listSubDirectories(root, gccDirRegExp);
        const installation = new GccInstallation();
        await installation.#initialize(...rootUris);
        // done
        logger.debug('GccInstallation.searchAutomationStudioGnuinst(root)', { root: root, result: installation });
        return installation;
    }

    /**
     * Creates a gcc version from a specified root directory
     * @param root The root directory containing a single gcc installation. e.g. `C:\BrAutomation\AS410\AS\gnuinst\V6.3.0`, or `C:\msys64\mingw64`
     * @returns The version which was parsed from the root URI
     */
    public static async createFromDir(root: vscode.Uri): Promise<GccInstallation> {
        // Create and initialize object
        const installation = new GccInstallation();
        await installation.#initialize(root);
        // done
        logger.debug('GccInstallation.createFromDir(root)', { root: root, result: installation });
        return installation;
    }

    /** Object is not ready to use after constructor due to async operations,
     * #initialize() has to be called for the object to be ready to use! */
    private constructor() { }

    /** Async operations to finalize object construction */
    async #initialize(...roots: vscode.Uri[]): Promise<void> {
        for (const root of roots) {
            // try parse version from directory name
            const dirName = uriTools.pathBasename(root);
            let version: semver.SemVer | undefined = undefined;
            const dirNameIsVersion = /^V(\d+).(\d+).(\d+)$/.test(dirName);
            if (dirNameIsVersion) {
                version = semver.coerce(dirName) ?? undefined;
            }
            // find bin directory
            const binDir = await uriTools.findDirectory(root, 2, 'bin');
            if (binDir === undefined) {
                logger.warning(`Could not find directory "bin" of gcc in ${logger.formatUri(root)}.`);
                continue;
            }
            // find *gcc.exe in bin directory
            const gccExePaths = await uriTools.listSubFiles(binDir, /^([\w\-_]*)gcc.exe$/);
            const gccExes = gccExePaths.map((exe) => new GccExecutable(exe, version));
            this.#executables.push(...gccExes);
        }
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** Targets available in this gcc version */
    public get executables(): GccExecutable[] {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized ${GccInstallation.name} object`); }
        return this.#executables;
    }
    #executables: GccExecutable[] = [];

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            executables: this.executables,
        };
    }

    /**
     * Get a `GccTarget` which fullfills the requested requirements.
     * @param version The requested gcc version
     * @param systemGeneration The requested B&R system generation
     * @param architecture The requested CPU architecture
     * @param strict If `true`, only exact matches will be returned
     * @returns A `GccTarget` which fullfills the requested requirements or `undefined` if no such was found.
     */
    public getExecutable(version?: semver.SemVer | string, systemGeneration?: SystemGeneration, architecture?: TargetArchitecture, strict?: boolean): GccExecutable | undefined {
        // directly return if no targets available
        if (this.executables.length === 0) {
            return undefined;
        }
        // prepare sorted array to select best target if there is no exact match. Best target will be index 0 (descending sort)
        const sorted = [...this.executables].sort((a, b) => GccExecutable.compareForQuery(b, a));
        // get matches for version, system generation and architecture. If argument === undefined all is a match
        const versionMatch = !version ? sorted : sorted.filter((el) => semver.eq(el.version, version));
        const sgMatch = !systemGeneration ? sorted : sorted.filter((el) => (el.systemGeneration === systemGeneration));
        const archMatch = !architecture ? sorted : sorted.filter((el) => (el.architecture === architecture));
        // get intersection of separate matches
        const allMatch = versionMatch.filter((ele) => (sgMatch.includes(ele) && archMatch.includes(ele)));
        // find best match: matchAll > versionMatch > sgMatch > archMatch > noMatch
        if (allMatch.length > 0) {
            return allMatch[0];
        } else if (strict) {
            return undefined;
        } else if (versionMatch.length > 0) {
            return versionMatch[0];
        } else if (sgMatch.length > 0) {
            return sgMatch[0];
        } else if (archMatch.length > 0) {
            return archMatch[0];
        } else {
            return sorted[0];
        }
    }
}