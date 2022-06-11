import { Uri } from 'vscode';
import { logger } from '../../Tools/Logger';
import { AsPackageFile, AsPackageObject } from './AsPackageFile';

/**
 * Configuration package file representation (Config.pkg in configuration directory). This package file contains additional
 * restrictions, as there has to be exactly one child of type 'Cpu'
 */
export class ConfigPackageFile extends AsPackageFile {

    /**
     * Creates a Configuration package file representation from a specified URI to the file
     * @param filePath The Configuration package file path. e.g. `C:\Projects\Test\Physical\TestCOnfig\Config.pkg`
     * @returns The Configuration package file representation which was parsed from the file
     */
    public static async createFromPath(filePath: Uri): Promise<ConfigPackageFile | undefined> {
        // Create and initialize object
        try {
            const xmlFile = new ConfigPackageFile(filePath);
            await xmlFile._initialize();
            return xmlFile;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to read Config package file from path '${filePath.fsPath}': ${error.message}`); //TODO uri log #33
            } else {
                logger.error(`Failed to read Config package file from path '${filePath.fsPath}'`); //TODO uri log #33
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
        if (this.type !== 'Configuration') {
            throw new Error('Root element name is not <Configuration>');
        }
        const cpuObjects = this.getChildrenOfType('Cpu');
        if (cpuObjects.length < 1) {
            throw new Error('No Cpu object found');
        }
        if (cpuObjects.length > 1) {
            throw new Error('Too many Cpu objects found');
        }
        this.#cpuChildObject = cpuObjects[0];
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** CPU and build configuration data */
    public get cpuChildObject() : AsPackageObject {
        if (!this.#isInitialized || !this.#cpuChildObject) { throw new Error(`Use of not initialized ${ConfigPackageFile.name} object`); }
        return this.#cpuChildObject;
    }
    #cpuChildObject: AsPackageObject | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        const obj = super.toJSON();
        obj.cpuChildObject = this.cpuChildObject;
        return obj;
    }
}