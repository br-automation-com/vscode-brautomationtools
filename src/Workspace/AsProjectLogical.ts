import { RelativePattern, Uri, workspace } from 'vscode';
import { logger } from '../Tools/Logger';
import { isSubOf, pathBasename, pathDirname } from '../Tools/UriTools';
import { AsProjectPou } from './AsProjectPOU';
import { AsPackageFile } from './Files/AsPackageFile';


/**
 * Representation of the Automation Studio project Logical View contents
 */
export class AsProjectLogical {
    /**
     * Creates a Logical representation from a URI to the package file (Package.pkg)
     * @param logicalPkgPath The POU package file path. e.g. `C:\Projects\Test\Logical\Package.pkg`
     * @returns The Logical representation which was parsed from the package file URI
     */
    public static async createFromPackage(logicalPkgPath: Uri, projectRoot: Uri): Promise<AsProjectLogical | undefined> {
        // Create and initialize object
        try {
            const pou = new AsProjectLogical(logicalPkgPath, projectRoot);
            await pou._initialize();
            return pou;
        } catch (error) {
            logger.error(`Failed to parse Logical View from path ${logger.formatUri(logicalPkgPath)}. ${logger.formatError(error)}`);
            return undefined;
        }
    }

    /** Object is not ready to use after constructor due to async operations,
     * #initialize() has to be called for the object to be ready to use! */
    protected constructor(logicalPkgPath: Uri, projectRoot: Uri) {
        this.#logicalPkgPath = logicalPkgPath;
        this.#projectRoot = projectRoot;
        this.#rootPath = pathDirname(logicalPkgPath);
        // other properties rely on async and will be initialized in #initialize()
    }

    /**
     * Async operations to finalize object construction
     * @throws If a required initialization process failed
     */
    protected async _initialize(): Promise<void> {
        this.#logicalPkg = await AsPackageFile.createFromFile(this.#logicalPkgPath);
        if (this.#logicalPkg === undefined) {
            throw new Error('Failed to create package file');
        }
        this.#pous = await AsProjectPou.searchPousInDir(this.#rootPath, this.#projectRoot);
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** Root path of the POU */
    public get rootPath(): Uri {
        return this.#rootPath;
    }
    #rootPath: Uri;

    /** Type of POU */
    public get pous(): AsProjectPou[] {
        if (!this.#isInitialized || !this.#pous) { throw new Error(`Use of not initialized object`); }
        return this.#pous;
    }
    #pous: AsProjectPou[] | undefined;

    #projectRoot: Uri;
    #logicalPkgPath: Uri;
    #logicalPkg: AsPackageFile | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            rootPath: this.rootPath.toString(true),
            pous: this.pous,
        };
    }

    public getPou(uri: Uri): AsProjectPou | undefined {
        // find matching POUs
        const matches = this.pous.filter((pou) => pou.uriIsInPou(uri));
        // return best fitting match
        if (matches.length === 0) {
            return undefined;
        } else if (matches.length === 1) {
            return matches[0];
        } else {
            // multiple matches -> longest matching path is closest to the result
            // this should actually not happen, as POU within POU is not allowed in AS
            logger.debug('POU within POU detected', {queryUri: uri.toString(true), matches: matches});
            let bestMatch = matches[0];
            for (const match of matches) {
                if (match.rootPath.path.length > bestMatch.rootPath.path.length) {
                    bestMatch = match;
                }
            }
            return bestMatch;
        }
    }

    /**
     * Checks if a given URI is within this POU
     * @param uri URI to check
     * @returns `true` if the URI is within the POU, `false` otherwise
     */
    public uriIsInLogical(uri: Uri): boolean {
        return isSubOf(this.rootPath, uri);
    }
}