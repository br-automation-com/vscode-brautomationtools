import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { anyToBoolOrUndefined } from '../../Tools/Helpers';
import { logger } from '../../Tools/Logger';
import { pathDirname, pathResolve, winPathToPosixPath } from '../../Tools/UriTools';
import { AsXmlFile } from './AsXmlFile';
import { ParsedXmlObject } from './AsXmlParser';

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
 * Generic Automation Studio package file representation. Can be used for all packages types without additional data.
 */
export class AsPackageFile extends AsXmlFile {

    /**
     * Automation Studio package file representation from a specified file pathe
     * @param filePath The path to the package file. e.g. `C:\Projects\Test\Logical\MyFolder\Package.pkg` or `C:\Projects\Test\Logical\MyLib\ANSIC.lby`
     * @returns The Automation Studio package file representation which was parsed from the file
     */
    public static async createFromFile(filePath: Uri): Promise<AsPackageFile | undefined> {
        // Create and initialize object
        try {
            const textDoc = await vscode.workspace.openTextDocument(filePath);
            const fileContent = textDoc.getText();
            return new AsPackageFile(filePath, fileContent);
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to read package file from path "${filePath.fsPath}": ${error.message}`); //TODO uri log #33
            } else {
                logger.error(`Failed to read package file from path "${filePath.fsPath}"`); //TODO uri log #33
            }
            logger.debug('Error details:', { error });
            return undefined;
        }
    }

    /** TODO doc */
    protected constructor(filePath: Uri, fileContent: string) {
        super(filePath, fileContent);
        this.#dirPath = pathDirname(this.filePath);
        this.#type = this.xmlRootName;
        this.#subType = getSubType(this.xmlRootObj);
        this.#childObjects = getChildObjects(this.xmlRootObj, this.#dirPath);
    }

    /** The path of the directory which contains this file */
    public get dirPath(): Uri {
        return this.#dirPath;
    }
    #dirPath: Uri;

    /** The type of the package */
    public get type(): string {
        return this.#type;
    }
    #type: string;

    /** The sub type of the package */
    public get subType(): string | undefined {
        return this.#subType;
    }
    #subType: string | undefined;

    /** Child objects of the package */
    public get childObjects(): AsPackageObject[] {
        return this.#childObjects;
    }
    #childObjects: AsPackageObject[];

    //TODO <Dependencies> element, but currently not used in any code

    /**
     * Returns all child objects of a specified type
     * @param type Type which is used as filter. The type is case insensitive, so e.g. `'Ansic'` will also match with `'ANSIC'`
     * @returns All child objects which are of the specified type
     */
    public getChildrenOfType(type: string): AsPackageObject[] {
        return this.childObjects.filter((obj) => (obj.type?.toLowerCase() === type.toLowerCase()));
    }

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        const obj = super.toJSON();
        obj.dirPath = this.dirPath.toString(true);
        obj.type = this.type;
        obj.subType = this.subType;
        obj.childObjects = this.childObjects;
        return obj;
    }
}

function getSubType(rootElement: ParsedXmlObject): string | undefined {
    const rootAny = rootElement as any;
    const subType = rootAny?._att?.SubType as unknown;
    return typeof subType === 'string' ? subType : undefined;
}

/**
 * Get all child objects from the package XML
 * @throws If there are multiple child object root nodes (<Files> or <Objects>)
 */
function getChildObjects(rootElement: ParsedXmlObject, packageDir: Uri): AsPackageObject[] {
    const childrenObj = getChildArrayData(rootElement);
    return childrenObj.children.map((child) => xmlElementToPackageObject(child, childrenObj.name, packageDir));
    //TODO test here 14.04.
}

function getChildArrayData(rootElement: ParsedXmlObject): { name: string, children: unknown[] } {
    /* TODO, should we really handle all package types in this main class?
    Maybe we'd better make a helper to extract the objects element from XML...
    It would be also easier to handle special cases such as the Files / Objects difference in libs and programs (not in normal pkg files?? old AS??)...
    */
    const rootAny = rootElement as any;
    let children: unknown;
    //
    children = rootAny?.Objects?.Object;
    if (children !== undefined) {
        if (!Array.isArray(children)) { throw new Error(`XML object "ROOT.Objects.Object is no array!"`); }
        return { name: 'Object', children: children };
    }
    //
    children = rootAny?.Files?.File;
    if (children !== undefined) {
        if (!Array.isArray(children)) { throw new Error(`XML object "ROOT.Files.File is no array!"`); }
        return { name: 'File', children: children };
    }
    //
    children = rootAny?.Configurations?.Configuration;
    if (children !== undefined) {
        if (!Array.isArray(children)) { throw new Error(`XML object "ROOT.Configurations.Configuration is no array!"`); }
        return { name: 'Configuration', children: children };
    }
    // no match --> error
    throw new Error('Package child objects data not found');
}

/**
 * Map an XML element to a package object
 * @param element A single <File> or <Object> element of the package file
 */
function xmlElementToPackageObject(child: unknown, childName: string, packageDir: Uri): AsPackageObject {
    const childAny = child as any;
    // path is mandatory and therefore throws if not existing
    let winPath: unknown = childAny?._txt;
    if (winPath === undefined && childName === 'Configuration') { // special case AS V3.0.90 Config.pkg
        winPath = childAny?._att?.Name;
    }
    if (typeof winPath !== 'string' || winPath.length === 0) {
        throw new Error(`<${childName}> element contains no path`);
    }
    const posixPath = winPathToPosixPath(winPath);
    // type has special handling, as in some packages the element name is set to 'File' instead of the 'Type' attribute
    let type: string | undefined = undefined;
    if (childName === 'File') {
        type = 'File';
    } else if (childName === 'Configuration') {
        type = 'Configuration';
    } else {
        const typeAttr = childAny._att.Type as unknown;
        type = typeof typeAttr === 'string' ? typeAttr : undefined;
    }
    // other attributes
    const isReference = anyToBoolOrUndefined(childAny?._att?.Reference);
    const isPrivate = anyToBoolOrUndefined(childAny?._att?.Private);
    const description = childAny?._att?.Description as unknown;
    const language = childAny?._att?.Language as unknown;
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
        description: typeof description === 'string' ? description : undefined,
        language: typeof language === 'string' ? language : undefined,
        isReference: isReference,
        isPrivate: isPrivate,
        resolvePath: resolvePath,
    };
}