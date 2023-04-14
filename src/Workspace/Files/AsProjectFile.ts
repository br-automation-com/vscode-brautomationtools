import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { anyToBoolOrUndefined } from '../../Tools/Helpers';
import { logger } from '../../Tools/Logger';
import { pathBasename } from '../../Tools/UriTools';
import { AsXmlFileNew } from './AsXmlFileNew';

/** Project global options for C-code */
//TODO use in new architecture for some default defines
export interface AsProjectCCodeOptions {
    /** Enable declarations of PLC variables in C-code with macros (e.g. `_LOCAL`) */
    readonly enablePlcVarDeclarations?: boolean | undefined,
    /** Enables default include mechanism (<AsDefault.h>) be defining the C-macro `_DEFAULT_INCLUDES` during build */
    readonly enableDefaultIncludes?: boolean | undefined,
}

/**
 * Automation Studio project file representation (*.apj)
 */
export class AsProjectFile extends AsXmlFileNew {

    /**
     * Creates an Automation Studio project file representation from a specified URI to the file
     * @param filePath The project file path. e.g. `C:\Projects\Test\Test.apj`
     * @returns The Automation Studio project file representation which was parsed from the file
     */
    public static async createFromFile(filePath: Uri): Promise<AsProjectFile | undefined> {
        // Create and initialize object
        try {
            const textDoc = await vscode.workspace.openTextDocument(filePath);
            const fileContent = textDoc.getText();
            return new AsProjectFile(filePath, fileContent);
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to read project file from path '${filePath.fsPath}': ${error.message}`); //TODO uri log #33
            } else {
                logger.error(`Failed to read project file from path '${filePath.fsPath}'`); //TODO uri log #33
            }
            logger.debug('Error details:', { error });
            return undefined;
        }
    }

    /** TODO doc */
    protected constructor(filePath: Uri, fileContent: string) {
        super(filePath, fileContent);
        // Check root object name
        if (this.xmlRootName !== 'Project') {
            throw new Error('Root element name is not <Project>');
        }
        // assign and check versions
        this.#workingVersion = this.versionHeader.asWorkingVersion ?? this.versionHeader.asVersion;
        this.#exactVersion = this.versionHeader.asVersion ?? this.versionHeader.asWorkingVersion;
        if (!this.#workingVersion || !this.#exactVersion) {
            logger.warning(`Could not find Automation Studio version data in '${this.filePath.toString(true)}'`); //TODO uri log #33
        }
        // Other properties
        this.#projectName = pathBasename(this.filePath);
        this.#projectDescription = getProjectDescription(this.xmlRootObj);
        this.#cCodeOptions = getCCodeOptions(this.xmlRootObj);
    }

    /** The name of the project */
    public get projectName(): string {
        return this.#projectName;
    }
    #projectName: string;

    /** The description text of the project */
    public get projectDescription(): string {
        return this.#projectDescription;
    }
    #projectDescription: string;

    /** The Automation Studio working version (can be less restrictive than `exactVersion`) */
    public get workingVersion(): string | undefined {
        return this.#workingVersion;
    }
    #workingVersion: string | undefined;

    /** The exact Automation Studio version used to edit the project */
    public get exactVersion(): string | undefined {
        return this.#exactVersion;
    }
    #exactVersion: string | undefined;

    /** Project global options for C-code */
    public get cCodeOptions(): AsProjectCCodeOptions {
        return this.#cCodeOptions;
    }
    #cCodeOptions: AsProjectCCodeOptions;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        const obj = super.toJSON();
        obj.projectName = this.projectName;
        obj.projectDescription = this.projectDescription;
        obj.workingVersion = this.workingVersion;
        obj.exactVersion = this.exactVersion;
        obj.cCodeOptions = this.cCodeOptions;
        return obj;
    }
}

/**
 * Get the C-Code options from XML object
 * @param rootElement The root <Project> element object
 */
function getCCodeOptions(rootElement: object): AsProjectCCodeOptions {
    const rootAny = rootElement as any;
    const cOptions = rootAny?.ANSIC?._att;
    return {
        enablePlcVarDeclarations: anyToBoolOrUndefined(cOptions?.Declarations),
        enableDefaultIncludes: anyToBoolOrUndefined(cOptions?.DefaultIncludes),
    };
}

function getProjectDescription(rootElement: object): string {
    const rootAny = rootElement as any;
    const description = rootAny?._att?.Description as unknown;
    return typeof description === 'string' ? description : '';
}