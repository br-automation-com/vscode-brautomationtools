import { Uri } from 'vscode';
import { logger } from '../../Tools/Logger';
import { getChildElements } from '../../Tools/XmlDom';
import { AsXmlFile } from './AsXmlFile';
import { Element as XmlElement } from '@oozcitak/dom/lib/dom/interfaces';
import { stringToBoolOrUndefined } from '../../Tools/Helpers';
import { pathDirname, pathJoin, pathResolve, winPathToPosixPath } from '../../Tools/UriTools';

/** Data of an object within a package */
export interface AsPackageObject {
    /** Path of the object. Interpretation of the path depends on the value of `isReference` */
    readonly path: string,
    /** Type of the object. e.g. 'Configuration', 'Program', 'File' */
    readonly type?: string | undefined,
    /** Language of the object, mostly used in library or program objects. e.g. 'IEC' or 'ANSIC' */
    readonly language?: string | undefined,
    /** Additional description of the object for documentation */
    readonly description?: string | undefined,
    /** The object is referenced (SymLink).
     * 
     * If `false` or `undefined`, path is relative to the directory containing the package file. Use `pathJoin(packageDir, path)` to get the full path.
     * 
     * If `true`, the path will be either relative to the project root or absolute. Use `pathResolve(projectRoot, path)` to get the full path.
     */
    readonly isReference?: boolean | undefined,
    /** Used for type and variable declaration files, to define if the declarations are global or limited to package scope. */
    readonly isPrivate?: boolean | undefined,
    /** Resolve `path` to get absolute URIs */
    readonly resolvePath: (projectRoot: Uri) => Uri;
}

/**
 * Generic Automation Studio package file. Can be used for all packages types without additional data.
 */
export class AsPackageFile extends AsXmlFile {

    /**
     * Creates an Automation Studio version from a specified root directory
     * @param filePath The root directory containing a single Automation Studio installation. e.g. `C:\BrAutomation\AS410`
     * @returns The version which was parsed from the root URI
     */
    public static async createFromPath(filePath: Uri): Promise<AsPackageFile | undefined> {
        // Create and initialize object
        try {
            const xmlFile = new AsPackageFile(filePath);
            await xmlFile._initialize();
            return xmlFile;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to read package file from path '${filePath.fsPath}': ${error.message}`);
            } else {
                logger.error(`Failed to read package file from path '${filePath.fsPath}'`);
            }
            logger.debug('Error details:', { error });
            return undefined;
        }
    }

    /** Object is not ready to use after constructor due to async operations,
     * #initialize() has to be called for the object to be ready to use! */
    protected constructor(filePath: Uri) {
        super(filePath);
        // other properties rely on async and will be initialized in #initialize()
    }

    /**
     * Async operations to finalize object construction
     * @throws If a required initialization process failed
     */
    protected async _initialize(): Promise<void> {
        await super._initialize();
        this.#dirPath = pathDirname(this.filePath);
        this.#type = this.rootElement.nodeName;
        this.#subType = this.rootElement.getAttribute('SubType') ?? undefined;
        this.#childObjects = getChildObjects(this.rootElement, this.#dirPath);
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** The path of the directory which contains this file */
    public get dirPath() : Uri {
        if (!this.#isInitialized || !this.#dirPath) { throw new Error(`Use of not initialized ${AsPackageFile.name} object`); }
        return this.#dirPath;
    }
    #dirPath: Uri | undefined;

    /** The type of the package */
    public get type() : string {
        if (!this.#isInitialized || !this.#type) { throw new Error(`Use of not initialized ${AsPackageFile.name} object`); }
        return this.#type;
    }
    #type: string | undefined;

    /** The sub type of the package */
    public get subType(): string | undefined {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized ${AsPackageFile.name} object`); }
        return this.#subType;
    }
    #subType: string | undefined;

    /** Child objects of the package */
    public get childObjects(): AsPackageObject[] {
        if (!this.#isInitialized || !this.#childObjects) { throw new Error(`Use of not initialized ${AsPackageFile.name} object`); }
        return this.#childObjects;
    }
    #childObjects: AsPackageObject[] | undefined;

    //TODO Dependencies element, but currently not used in any code

    /**
     * Returns all child objects of a specified type
     * @param type Type which is used as filter
     * @returns All child objects which are of the specified type
     */
    public getChildrenOfType(type: string): AsPackageObject[] {
        return this.childObjects.filter((obj) => (obj.type === type));
    }

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        const obj = super.toJSON();
        obj.rootPath = this.dirPath.toString(true);
        obj.type = this.type;
        obj.subType = this.subType;
        obj.childObjects = this.childObjects;
        return obj;
    }
}

/**
 * Get all child objects from the package XML
 * @throws If there are multiple child object root nodes (<Files> or <Objects>)
 */
function getChildObjects(rootElement: XmlElement, packageDir: Uri): AsPackageObject[] {
    // get root element of objects
    const objectRootFilter = /^Files|Objects$/m;
    const objectRoot = getChildElements(rootElement, objectRootFilter);
    if (objectRoot.length !== 1) {
        throw new Error(`Too many or too few <Objects> or <Files> elements (${objectRoot.length} elements)`);
    }
    // get objects in package
    const objectElementFilter = /^File|Object$/m;
    const objectElements = getChildElements(objectRoot[0], objectElementFilter);
    return objectElements.map((ele) => xmlElementToPackageObject(ele, packageDir));
}

/**
 * Map an XML element to a package object
 * @param element A single <File> or <Object> element of the package file
 */
function xmlElementToPackageObject(element: XmlElement, packageDir: Uri): AsPackageObject {
    // path is mandatory and therefore throws if not existing
    const winPath = element.textContent;
    if (!winPath) {
        throw new Error(`<${element.nodeName}> element contains no path`);
    }
    const posixPath = winPathToPosixPath(winPath);
    // type has special handling, as in some packages the element name is set to 'File' instead of the 'Type' attribute
    let type: string | undefined = undefined;
    if (element.nodeName === 'File') {
        type = 'File';
    } else {
        type = element.getAttribute('Type') ?? undefined;
    }
    // boolean attributes
    const isReferenceValue = element.getAttribute('Reference') ?? undefined;
    const isReference = stringToBoolOrUndefined(isReferenceValue);
    const isPrivateValue = element.getAttribute('Private') ?? undefined;
    const isPrivate = stringToBoolOrUndefined(isPrivateValue);
    // function to resolve path from project root
    const resolvePath = (projectRoot: Uri) => {
        if (!isReference) {
            return pathResolve(packageDir, posixPath);
        } else {
            return pathResolve(projectRoot, posixPath);
        }
    };
    // return result
    return {
        path: posixPath,
        type: type,
        description: element.getAttribute('Description') ?? undefined,
        language: element.getAttribute('Language') ?? undefined,
        isReference: isReference,
        isPrivate: isPrivate,
        resolvePath: resolvePath,
    };
}