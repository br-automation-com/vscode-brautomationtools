import { RelativePattern, Uri, workspace } from 'vscode';
import { logger } from '../Tools/Logger';
import { isSubOf, pathBasename, pathDirname } from '../Tools/UriTools';
import { AsPackageFile } from './Files/AsPackageFile';


export type AsProjectPouType = 'library' | 'program' | 'dataObject' | 'other';
export type AsProjectPouLanguage = 'IEC' | 'C/C++' | 'binary' | 'other';

/**
 * Representation of a project program organization unit (POU).
 * A POU can be a library, a program or a data object
 */
export class AsProjectPou {

    /**
     * Recursively searches for all POUs within a directory
     * @param searchRoot Root directory for start of search
     * @returns All POUs found within the search root and sub directories
     */
    public static async searchPousInDir(searchRoot: Uri, projectRoot: Uri): Promise<AsProjectPou[]> {
        // get matching package files
        const pouPattern = new RelativePattern(searchRoot, '**/*.{prg,lby,dob}');
        const pkgFilePaths = await workspace.findFiles(pouPattern);
        // create POUs for all files
        const pous: AsProjectPou[] = [];
        for (const file of pkgFilePaths) {
            const pou = await this.createFromPouPackage(file, projectRoot);
            if (pou !== undefined) {
                pous.push(pou);
            }
        }
        // done
        return pous;
    }

    /**
     * Creates a POU from a URI to the POU package file (*.lby / *.prg)
     * @param pouPkgPath The POU package file path. e.g. `C:\Projects\Test\Logical\TestPrg\IEC.prg`
     * @returns The POU which was parsed from the package file URI
     */
    public static async createFromPouPackage(pouPkgPath: Uri, projectRoot: Uri): Promise<AsProjectPou | undefined> {
        // Create and initialize object
        try {
            const pou = new AsProjectPou(pouPkgPath, projectRoot);
            await pou._initialize();
            return pou;
        } catch (error) {
            logger.error(`Failed to parse POU from path ${logger.formatUri(pouPkgPath)}. ${logger.formatError(error)}`);
            return undefined;
        }
    }

    /** Object is not ready to use after constructor due to async operations,
     * #initialize() has to be called for the object to be ready to use! */
    protected constructor(pouPkgPath: Uri, projectRoot: Uri) {
        this.#pouPkgPath = pouPkgPath;
        this.#projectRoot = projectRoot;
        this.#rootPath = pathDirname(pouPkgPath);
        // other properties rely on async and will be initialized in #initialize()
    }

    /**
     * Async operations to finalize object construction
     * @throws If a required initialization process failed
     */
    protected async _initialize(): Promise<void> {
        this.#pouPkg = await AsPackageFile.createFromFile(this.#pouPkgPath);
        if (this.#pouPkg === undefined) {
            throw new Error('Failed to create package file');
        }
        this.#type = getPouTypeFromPackage(this.#pouPkg);
        this.#language = getPouLanguageFromPackage(this.#pouPkg, this.#type);
        //TODO list all files. This could maybe done on the AsPackageFile level with new methods
        //     e.g. AsPackageFile.getSubPackages(), .getFiles(), .traverse()
        const fileUris = this.#pouPkg.getChildrenOfType('File')
            .map((child) => child.resolvePath(this.#projectRoot));
        this.#listedFiles = fileUris;
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
    public get type(): AsProjectPouType {
        if (!this.#isInitialized || !this.#type) { throw new Error(`Use of not initialized object`); }
        return this.#type;
    }
    #type: AsProjectPouType | undefined;

    /** Language of the POU */
    public get language(): AsProjectPouLanguage {
        if (!this.#isInitialized || !this.#language) { throw new Error(`Use of not initialized object`); }
        return this.#language;
    }
    #language: AsProjectPouLanguage | undefined;

    /** Files listed within the POU package or any listed sub package */
    public get listedFiles(): Uri[] {
        if (!this.#isInitialized || !this.#listedFiles) { throw new Error(`Use of not initialized object`); }
        return this.#listedFiles;
    }
    #listedFiles: Uri[] | undefined;

    #projectRoot: Uri;
    #pouPkgPath: Uri;
    #pouPkg: AsPackageFile | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            rootPath: this.rootPath.toString(true),
            type: this.type,
            language: this.language,
            listedFiles: this.listedFiles.map((uri) => uri.toString(true)),
        };
    }

    /**
     * Checks if a given URI is within this POU
     * @param uri URI to check
     * @returns `true` if the URI is within the POU, `false` otherwise
     */
    public uriIsInPou(uri: Uri): boolean {
        return isSubOf(this.rootPath, uri);
    }
}

/**
 * Get the type of the POU from the package
 * @param pouPkg The package file of the POU
 * @returns The type of the POU or undefined
 */
function getPouTypeFromPackage(pouPkg: AsPackageFile): AsProjectPouType {
    const pkgType = pouPkg.type.toLowerCase();
    switch (pkgType) {
        case 'program':
            return 'program';
        case 'library':
            return 'library';
        case 'dataobject':
            return 'dataObject';
        default:
            return 'other';
    }
}

/**
 * Get the source code language of the POU from the package
 * @param pouPkg The package file of the POU
 * @param pouType The type of POU, so it doesn't have to be evaluated again
 * @returns The language of the POU or undefined
 */
function getPouLanguageFromPackage(pouPkg: AsPackageFile, pouType: AsProjectPouType): AsProjectPouLanguage {
    const pkgSubType = pouPkg.subType?.toLowerCase();
    // data objects are special, as they can have C/C++ or dat language, we will consider them as C/C++
    if (pouType === 'dataObject') {
        return 'C/C++';
    }
    // sub type defines language for programs and libraries in newer AS versions
    if (pkgSubType !== undefined) {
        switch (pkgSubType) {
            case 'ansic':
                return 'C/C++';
            case 'iec':
                return 'IEC';
            case 'binary':
                return 'binary';
            default:
                return 'other';
        }
    }
    // get the language from the file name for packages from older AS versions
    const pkgFileName = pathBasename(pouPkg.filePath).toLowerCase();
    switch (pkgFileName) {
        case 'ansic.lby':
        case 'ansic.prg':
            return 'C/C++';
        case 'iec.lby':
        case 'iec.prg':
            return 'IEC';
        case 'binary.lby':
        case 'binary.prg':
            return 'binary';
        default:
            return 'other';
    }
}