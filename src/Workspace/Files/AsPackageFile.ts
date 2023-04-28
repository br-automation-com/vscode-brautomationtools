import * as vscode from "vscode";
import { Uri } from "vscode";
import { anyToBoolOrUndefined } from "../../Tools/Helpers";
import { logger } from "../../Tools/Logger";
import { isNonNullObject } from "../../Tools/TypeGuards";
import { exists, getInvalidUri, listSubDirectories, listSubFiles, pathBasename, pathDirname, pathResolve, urisEqual, winPathToPosixPath } from "../../Tools/UriTools";
import { AsPackageObject, packageObjectFromDirPath, packageObjectFromFilePath } from "./AsPackageObject";
import { AsXmlFile } from "./AsXmlFile";
import { ParsedXmlObject } from "./AsXmlParser";

/**
 * Generic Automation Studio package file representation. Can be used for all packages types without additional data.
 */
export class AsPackageFile extends AsXmlFile {
    //TODO should we add new property 'referencesBasePath' which would remove the parameter 'projectRoot' for resolving the URI of the child? With this we could even remove the function resolvePath() and replace it with a URI property
    /**
     * Checks if a file name is a package file name
     * @param filePath Path to the file which should be checked
     * @returns true if the base file name of the path is a name of some kind of package file
     */
    public static isPackageFileName(filePath: Uri): boolean {
        const fileName = pathBasename(filePath);
        // check all known package names
        if (fileName.endsWith(".pkg")) return true;
        if (fileName.endsWith(".lby")) return true;
        if (fileName.endsWith(".prg")) return true;
        if (fileName.endsWith(".dob")) return true;
        // false for all other files
        return false;
    }

    /**
     * Automation Studio package file representation from a specified file pathe
     * @param filePath The path to the package file. e.g. `C:\Projects\Test\Logical\MyFolder\Package.pkg` or `C:\Projects\Test\Logical\MyLib\ANSIC.lby`
     * @returns The Automation Studio package file representation which was parsed from the file
     */
    public static override async createFromFile(filePath: Uri): Promise<AsPackageFile | undefined> {
        // Create and initialize object
        try {
            const textDoc = await vscode.workspace.openTextDocument(filePath);
            const fileContent = textDoc.getText();
            return new AsPackageFile(filePath, fileContent);
        } catch (error) {
            logger.error(`Failed to read package file from path ${logger.formatUri(filePath)}. ${logger.formatError(error)}`);
            return undefined;
        }
    }

    /** TODO doc */
    protected constructor(filePath: Uri, fileContent: string) {
        super(filePath, fileContent);
        this.#dirPath = pathDirname(this.filePath);
        this.#type = this.xmlRootName;
        this.#subType = getSubType(this.xmlRootObj);
        const xmlChildData = getXmlChildArrayData(this.xmlRootObj);
        this.#xmlChildObjectsName = xmlChildData.name;
        this.#xmlChildObjects = xmlChildData.children;
        this.#childObjects = xmlChildData.children.map((child) => xmlElementToPackageObject(child, xmlChildData.name, this.#dirPath));
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
    #xmlChildObjects: unknown[];
    #xmlChildObjectsName: string;

    /**
     * Update the XML Object from the childObjects Array
     */
    private updateXmlChildrenData(): void {
        // Currently handling for a change between XML Element "Files" and "Objects" is not implemented. This happens only in prg and lby if there are no packages within
        if (this.#xmlChildObjectsName !== "Object") {
            logger.error("Update of package XML content only possible for files with <Objects> element.");
            return;
        }
        // clear array and add based on childObjects
        const newElements = this.childObjects.map((child) => packageElementToXmlObj(child));
        this.#xmlChildObjects.length = 0;
        this.#xmlChildObjects.push(...newElements);
    }

    /**
     * Remove all child objects which do not exist in the file system from the package object.
     * @param keepReferences If set to true, non-existing referenced files will be kept in the package
     */
    public async removeNonExtistingChildren(keepReferences = false): Promise<void> {
        if (!keepReferences) {
            // To also remove references, we would need the proper full path of the referenced items. For this we would need the project root path...
            logger.error("Removing non-existing referenced files from package not implemented!");
            return;
        }
        // find all children which should be kept
        const DUMMY_URI = getInvalidUri(); // HACK Dummy for resolve. Resolving of non-references should not require the project URI
        const itemsToKeep: AsPackageObject[] = []; // cannot use Array.filter() because of async
        for (const obj of this.childObjects) {
            if (keepReferences && obj.isReference === true) {
                itemsToKeep.push(obj);
                continue;
            }
            const objPath = obj.resolvePath(DUMMY_URI);
            const objExists = await exists(objPath);
            if (objExists) {
                itemsToKeep.push(obj);
                continue;
            }
        }
        // clear and refill children array
        this.#childObjects.length = 0;
        this.#childObjects.push(...itemsToKeep);
        this.updateXmlChildrenData();
    }

    /**
     * Add child objects for files and packages which exist in the package directory but are not yet listed.
     */
    public async addMissingChildren(): Promise<void> {
        const DUMMY_URI = getInvalidUri(); // HACK Dummy for resolve. Resolving of non-references should not require the project URI
        const pathsInPkg = this.childObjects.filter((obj) => obj.isReference !== true).map((obj) => obj.resolvePath(DUMMY_URI));
        // Compare files in file system / in package file and add
        const filePathsOnFs = (await listSubFiles(this.dirPath)).filter((filePath) => filePath.toString() !== this.filePath.toString());
        for (const pathOnFs of filePathsOnFs) {
            const isDuplicate = pathsInPkg.some((pathInPkg) => urisEqual(pathInPkg, pathOnFs));
            if (!isDuplicate) {
                const pkgObj = await packageObjectFromFilePath(pathOnFs);
                if (pkgObj !== undefined) {
                    this.childObjects.push(pkgObj);
                } else {
                    logger.error(`Could not add file ${logger.formatUri(pathOnFs)} to package ${logger.formatUri(this.filePath)}`);
                }
            }
        }
        // Compare directories in file system / in package file and add
        const dirPathsOnFs = await listSubDirectories(this.dirPath);
        for (const pathOnFs of dirPathsOnFs) {
            const isDuplicate = pathsInPkg.some((pathInPkg) => urisEqual(pathInPkg, pathOnFs));
            if (!isDuplicate) {
                const pkgObj = await packageObjectFromDirPath(pathOnFs);
                if (pkgObj !== undefined) {
                    this.childObjects.push(pkgObj);
                } else {
                    logger.error(`Could not add directory ${logger.formatUri(pathOnFs)} to package ${logger.formatUri(this.filePath)}`);
                }
            }
        }
        this.updateXmlChildrenData();
    }

    /**
     * Update package file object contents from the files and packages which exist in the package directory.
     * @param keepNonExistingReferences If set to true, non-existing referenced files will be kept in the package
     */
    public async updateChildren(keepNonExistingReferences = false): Promise<void> {
        await this.removeNonExtistingChildren(keepNonExistingReferences);
        await this.addMissingChildren();
    }

    //TODO <Dependencies> element, but currently not used in any code

    /**
     * Returns all child objects of a specified type
     * @param type Type which is used as filter. The type is case insensitive, so e.g. `'Ansic'` will also match with `'ANSIC'`
     * @returns All child objects which are of the specified type
     */
    public getChildrenOfType(type: string): AsPackageObject[] {
        return this.childObjects.filter((obj) => obj.type?.toLowerCase() === type.toLowerCase());
    }

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public override toJSON(): Record<string, unknown> {
        const obj = super.toJSON();
        obj.dirPath = this.dirPath.toString(true);
        obj.type = this.type;
        obj.subType = this.subType;
        obj.childObjects = this.childObjects;
        return obj;
    }
}

function getSubType(rootElement: ParsedXmlObject): string | undefined {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const rootAny = rootElement as any;
    const subType = rootAny?._att?.SubType as unknown;
    /* eslint-enable */
    return typeof subType === "string" ? subType : undefined;
}

function getXmlChildArrayDataOld(rootElement: ParsedXmlObject): { name: string; children: unknown[] } {
    /* TODO, should we really handle all package types in this main class?
    Maybe we'd better make a helper to extract the objects element from XML...
    It would be also easier to handle special cases such as the Files / Objects difference in libs and programs (not in normal pkg files?? old AS??)...
    */
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const rootAny = rootElement as any;
    let children: unknown;
    //
    children = rootAny?.Objects?.Object;
    if (children !== undefined) {
        if (!Array.isArray(children)) throw new Error(`XML object "ROOT.Objects.Object is no array!"`);
        return { name: "Object", children: children };
    }
    //
    // children = rootAny?.Files?.File;
    // if (children !== undefined) {
    //     if (!Array.isArray(children)) throw new Error(`XML object "ROOT.Files.File is no array!"`);
    //     return { name: "File", children: children };
    // }
    //TODO test new implementation
    if ("Files" in rootElement) {
        if (!isNonNullObject(rootElement.Files)) throw new Error("XXXXX");
        if (!("File" in rootElement.Files)) {
            (rootElement.Files as Record<string, unknown>).File = [];
            return { name: "File", children: [] };
        } else {
            children = rootElement.Files.File;
            if (!Array.isArray(children)) throw new Error(`XML object "ROOT.Files.File is no array!"`);
            return { name: "File", children: children };
        }
    }
    //
    children = rootAny?.Configurations?.Configuration;
    if (children !== undefined) {
        if (!Array.isArray(children)) throw new Error(`XML object "ROOT.Configurations.Configuration is no array!"`);
        return { name: "Configuration", children: children };
    }
    /* eslint-enable */
    // no match --> error
    throw new Error("Package child objects data not found");
}

function getXmlChildArrayData(rootElement: ParsedXmlObject): { name: string; children: unknown[] } {
    // Test for Objects
    const objects = getXmlChildArrayByNames(rootElement, "Objects", "Object");
    if (objects !== undefined) return { name: "Object", children: objects };
    // Test for Files
    const files = getXmlChildArrayByNames(rootElement, "Files", "File");
    if (files !== undefined) return { name: "File", children: files };
    // Test for Configurations
    const configurations = getXmlChildArrayByNames(rootElement, "Configurations", "Configuration");
    if (configurations !== undefined) return { name: "Configuration", children: configurations };
    // no match --> error
    throw new Error("Package child objects data not found");
}

/**
 * TODO a bit detail
 * @param rootElement Root element object of the parsed XML data
 * @param nameLv1 Name of the first level property / XML element, e.g. `"Objects"`
 * @param nameLv2 Name of the first level property / XML element, e.g. `"Objects.Object"`
 * @returns The array representing the second level data. If only the first level exists, an empty array is added to the XML object. `undefined` if no property with key `nameLv1` exists in the `rootElement`
 * @throws If the level1 object was found and afterwards some of the type guards failed
 */
function getXmlChildArrayByNames(rootElement: ParsedXmlObject, nameLv1: string, nameLv2: string): unknown[] | undefined {
    // Get lv1 object, needs to be an object if it exists
    const [, lv1Property] = Object.entries(rootElement)
        .map(([k, v]) => [k, v as unknown])
        .find(([key, _]) => key === nameLv1) ?? [nameLv1, undefined];
    // check value of lv1 object
    if (lv1Property === undefined) return undefined;
    if (!isNonNullObject(lv1Property)) throw new Error(`XML object "ROOT.${nameLv1} is no object!"`);
    // get lv2 object
    const [, lv2Property] = Object.entries(lv1Property)
        .map(([k, v]) => [k, v as unknown])
        .find(([key, _]) => key === nameLv2) ?? [nameLv2, undefined];
    // check value of lv2 object
    if (lv2Property === undefined) {
        // Lv2 property does not exist -> create property with empty array
        const newChildren: unknown[] = [];
        (lv1Property as Record<string, unknown>)[nameLv2] = newChildren;
        return newChildren;
    } else if (Array.isArray(lv2Property)) {
        return lv2Property as unknown[];
    } else {
        throw new Error(`XML object "ROOT.${nameLv1}.${nameLv2} is no array!"`);
    }
    //TODO why does following not work?
    // const name32 = name1;
    // if (name32 in rootElement) {
    //     if (!isNonNullObject(rootElement[name32])) throw new Error("XXXXX");
    // }
}

/**
 * Map an XML element to a package object
 * @param element A single <File> or <Object> element of the package file
 */
function xmlElementToPackageObject(child: unknown, childName: string, packageDir: Uri): AsPackageObject {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const childAny = child as any;
    // path is mandatory and therefore throws if not existing
    let winPath: unknown = childAny?._txt;
    if (winPath === undefined && childName === "Configuration") {
        // special case AS V3.0.90 Config.pkg
        winPath = childAny?._att?.Name;
    }
    if (typeof winPath !== "string" || winPath.length === 0) {
        throw new Error(`<${childName}> element contains no path`);
    }
    const posixPath = winPathToPosixPath(winPath);
    // type has special handling, as in some packages the element name is set to 'File' instead of the 'Type' attribute
    let type: string | undefined = undefined;
    if (childName === "File") {
        type = "File";
    } else if (childName === "Configuration") {
        type = "Configuration";
    } else {
        const typeAttr = childAny._att.Type as unknown;
        type = typeof typeAttr === "string" ? typeAttr : undefined;
    }
    // other attributes
    const isReference = anyToBoolOrUndefined(childAny?._att?.Reference);
    const isPrivate = anyToBoolOrUndefined(childAny?._att?.Private);
    const description = childAny?._att?.Description as unknown;
    const language = childAny?._att?.Language as unknown;
    /* eslint-enable */
    // function to resolve path from project root or from package directory
    const resolvePath: (prjRoot: Uri) => Uri = isReference === true ? (prjRoot) => pathResolve(prjRoot, posixPath) : () => pathResolve(packageDir, posixPath);
    // return result
    return {
        path: posixPath,
        type: type,
        description: typeof description === "string" ? description : undefined,
        language: typeof language === "string" ? language : undefined,
        isReference: isReference,
        isPrivate: isPrivate,
        resolvePath: resolvePath,
    };
}

function packageElementToXmlObj(pkgElem: AsPackageObject): ParsedXmlObject {
    // TODO proper path and Windows ref path handling
    // TODO move to AsPackageObject file?
    /* eslint-disable @typescript-eslint/naming-convention */
    return {
        _txt: pkgElem.path,
        _att: {
            Type: pkgElem.type,
            Language: pkgElem.language,
            Description: pkgElem.description,
            Private: pkgElem.isPrivate,
            Reference: pkgElem.isReference,
        },
    };
    /* eslint-enable */
}
