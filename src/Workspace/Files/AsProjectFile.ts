import { Uri } from 'vscode';
import { logger } from '../../Tools/Logger';
import { getChildElements } from '../../Tools/XmlDom';
import { AsXmlFile } from './AsXmlFile';
import { Element as XmlElement } from '@oozcitak/dom/lib/dom/interfaces';
import { stringToBoolOrUndefined } from '../../Tools/Helpers';
import { pathBasename, pathDirname, pathJoin, pathResolve, winPathToPosixPath } from '../../Tools/UriTools';

/** Project global options for C-code */
//TODO use in new architecture for some defines
export interface AsProjectCCodeOptions {
    /** Enable declarations of PLC variables in C-code with macros (e.g. `_LOCAL`) */
    readonly enablePlcVarDeclarations?: boolean | undefined,
    /** Enables default include mechanism (<AsDefault.h>) be defining the C-macro `_DEFAULT_INCLUDES` during build */
    readonly enableDefaultIncludes?: boolean | undefined,
}

/**
 * Automation Studio project file (*.apj)
 */
export class AsProjectFile extends AsXmlFile {

    /**
     * Creates an Automation Studio project file from a specified URI to the file
     * @param filePath The project file path. e.g. `C:\Projects\Test\Test.apj`
     * @returns The file which was parsed from the file URI
     */
    public static async createFromPath(filePath: Uri): Promise<AsProjectFile | undefined> {
        // Create and initialize object
        try {
            const xmlFile = new AsProjectFile(filePath);
            await xmlFile._initialize();
            return xmlFile;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to read project file from path '${filePath.fsPath}': ${error.message}`);
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
        this.#projectRoot = pathDirname(this.filePath);
        // assign and check versions
        this.#version = this.header.asWorkingVersion ?? this.header.asVersion;
        this.#exactVersion = this.header.asVersion ?? this.header.asWorkingVersion;
        if (!this.#version || !this.#exactVersion) {
            throw new Error('Could not find Automation Studio version data');
        }
        // Other properties
        this.#projectName = pathBasename(this.filePath);
        this.#projectDescription = this.rootElement.getAttribute('Description') ?? '';
        this.#cCodeOptions = getCCodeOptions(this.rootElement);
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** The project root directory */
    public get projectRoot() : Uri {
        if (!this.#isInitialized || !this.#projectRoot) { throw new Error(`Use of not initialized ${AsProjectFile.name} object`); }
        return this.#projectRoot;
    }
    #projectRoot: Uri | undefined;

    /** The name of the project */
    public get projectName() : string {
        if (!this.#isInitialized || !this.#projectName) { throw new Error(`Use of not initialized ${AsProjectFile.name} object`); }
        return this.#projectName;
    }
    #projectName: string | undefined;

    /** The description text of the project */
    public get projectDescription(): string {
        if (!this.#isInitialized || !this.#projectDescription) { throw new Error(`Use of not initialized ${AsProjectFile.name} object`); }
        return this.#projectDescription;
    }
    #projectDescription: string | undefined;

    /** The Automation Studio working version (can be less restrictive than `exactVersion`) */
    public get version() : string {
        if (!this.#isInitialized || !this.#version) { throw new Error(`Use of not initialized ${AsProjectFile.name} object`); }
        return this.#version;
    }
    #version: string | undefined;

    /** The exact Automation Studio version used to edit the project */
    public get exactVersion() : string {
        if (!this.#isInitialized || !this.#exactVersion) { throw new Error(`Use of not initialized ${AsProjectFile.name} object`); }
        return this.#exactVersion;
    }
    #exactVersion: string | undefined;

    /** Project global options for C-code */
    public get cCodeOptions(): AsProjectCCodeOptions {
        if (!this.#isInitialized || !this.#cCodeOptions) { throw new Error(`Use of not initialized ${AsProjectFile.name} object`); }
        return this.#cCodeOptions;
    }
    #cCodeOptions: AsProjectCCodeOptions | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        const obj = super.toJSON();
        obj.projectRoot = this.projectRoot.toString(true);
        obj.projectName = this.projectName;
        obj.projectDescription = this.projectDescription;
        obj.version = this.version;
        obj.exactVersion = this.exactVersion;
        obj.cCodeOptions = this.cCodeOptions;
        return obj;
    }
}

/**
 * Get the C-Code options from XML
 * @param rootElement The root <Project> element
 */
function getCCodeOptions(rootElement: XmlElement): AsProjectCCodeOptions {
    // Get element containing C-code options
    const cOptionsElement = getChildElements(rootElement, /ANSIC/i).pop();
    // Get boolean attributes
    const enableDeclareValue = cOptionsElement?.getAttribute('Declarations');
    const enableDeclare = stringToBoolOrUndefined(enableDeclareValue);
    const enableDefaultIncludesValue = cOptionsElement?.getAttribute('DefaultIncludes');
    const enableDefaultIncludes = stringToBoolOrUndefined(enableDefaultIncludesValue);
    // return result
    return {
        enablePlcVarDeclarations: enableDeclare,
        enableDefaultIncludes: enableDefaultIncludes,
    };
}