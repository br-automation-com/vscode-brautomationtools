import * as vscode from 'vscode';
import * as uriTools from '../Tools/UriTools';
import * as semver from 'semver';
import { logger } from '../BrLog';
import { SystemGeneration, TargetArchitecture } from './CommonTypes';
import { GccTarget } from './GccTarget';

/**
 * Representation of a gcc version
 */
export class GccVersion {

    /**
     * Gets all gcc versions which are located in the rootUri.
     * @param rootUri The root directory containing multiple gcc installations. e.g. `C:\BrAutomation\AS410\AS\gnuinst`
     * @returns An array with all found versions
     */
    public static async searchVersionsInDir(rootUri: vscode.Uri): Promise<GccVersion[]> {
        // Get matching subdirectory names
        const subDirNames = await uriTools.listSubDirectoryNames(rootUri);
        const gccDirRegExp = new RegExp('^V(\\d+).(\\d+).(\\d+)$');
        const matching = subDirNames.filter((d) => gccDirRegExp.test(d)).map((d) => gccDirRegExp.exec(d));
        // create GccVersion from matching subdirectories
        const result: GccVersion[] = [];
        for (const match of matching) {
            const gccVersionUri = vscode.Uri.joinPath(rootUri, `./${match![0]}`);
            const gccVersion = await this.createFromDir(gccVersionUri);
            if (gccVersion !== undefined) {
                result.push(gccVersion);
            }
        }
        // done
        return result;
    }

    /**
     * Creates a gcc version from a specified root directory
     * @param rootUri The root directory containing a single gcc installation. e.g. `C:\BrAutomation\AS410\AS\gnuinst\V6.3.0`
     * @returns The version which was parsed from the root URI
     */
    public static async createFromDir(rootUri: vscode.Uri): Promise<GccVersion | undefined> {
        // Create and initialize object
        try {
            const gccVersion = new GccVersion(rootUri);
            await gccVersion.#initialize();
            logger.info(`gcc Version V${gccVersion.version.version} found in '${gccVersion.rootUri.fsPath}'`);
            return gccVersion;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to get gcc in path '${rootUri.fsPath}': ${error.message}`);
            } else {
                logger.error(`Failed to get gcc in path '${rootUri.fsPath}'`);
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
    async #initialize(): Promise<void> {
        // find targets
        const findGccExePattern = new vscode.RelativePattern(this.#rootUri, '**/bin/*-gcc.exe');
        const gccExes = await vscode.workspace.findFiles(findGccExePattern);
        this.#targets = gccExes.map((exe) => new GccTarget(exe, this.#version));
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** The root URI of the gcc version */
    public get rootUri(): vscode.Uri {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized ${GccVersion.name} object`); }
        return this.#rootUri;
    }
    #rootUri: vscode.Uri;

    /** The gcc version */
    public get version(): semver.SemVer {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized ${GccVersion.name} object`); }
        return this.#version;
    }
    #version: semver.SemVer;

    /** Targets available in this gcc version */
    public get targets(): GccTarget[] {
        if (this.#targets === undefined) { throw new Error(`Use of not initialized ${GccVersion.name} object`); }
        return this.#targets;
    }
    #targets: GccTarget[] | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            rootUri: this.rootUri.toString(true),
            version: this.version.version,
            targets: this.#targets,
        };
    }

    /**
     * Get a `GccTarget` which fullfills the requested requirements.
     * @param systemGeneration The requested B&R system generation
     * @param architecture The requested CPU architecture
     * @param strict If `true`, only exact matches will be returned
     * @returns A `GccTarget` which fullfills the requested requirements or `undefined` if no such was found.
     */
    public getTarget(systemGeneration?: SystemGeneration, architecture?: TargetArchitecture, strict?: boolean): GccTarget |undefined {
        // directly return if no targets available
        if (this.targets.length === 0) {
            return undefined;
        }
        // prepare sorted array to select best target if there is no exact match. Best target will be index 0 (descending sort)
        const sorted = [...this.targets].sort((a, b) => (b.sortValue - a.sortValue));
        // get matches for system generation and architecture. If argument === undefined all is a match
        const sgMatch = !systemGeneration ? sorted : sorted.filter((el) => (el.systemGeneration === systemGeneration));
        const archMatch = !architecture ? sorted : sorted.filter((el) => (el.architecture === architecture));
        // get intersection of separate matches
        const allMatch = sgMatch.filter((sgEle) => archMatch.includes(sgEle));
        // find best match: matchAll > matchSg > matchArch > matchNone
        if (allMatch.length > 0) {
            return allMatch[0];
        } else if (strict) {
            return undefined;
        } else if (sgMatch.length > 0) {
            return sgMatch[0];
        } else if (archMatch.length > 0) {
            return archMatch[0];
        } else {
            return sorted[0];
        }
    }
}