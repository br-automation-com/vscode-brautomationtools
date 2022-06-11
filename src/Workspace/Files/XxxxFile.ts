import { Uri } from 'vscode';
import { logger } from '../../Tools/Logger';
import { getChildElements } from '../../Tools/XmlDom';
import { AsXmlFile } from './AsXmlFile';
import { Element as XmlElement } from '@oozcitak/dom/lib/dom/interfaces';
import { stringToBoolOrUndefined } from '../../Tools/Helpers';
import { pathBasename, pathDirname, pathJoin, pathResolve, winPathToPosixPath } from '../../Tools/UriTools';

/**
 * XXXXX file representation (*.xxxx)
 */
export class XxxxFile extends AsXmlFile {

    /**
     * Creates an XXXX file representation from a specified URI to the file
     * @param filePath The XXXX file path. e.g. `C:\Projects\Test\XXXX.xxxx`
     * @returns The XXXX file representation which was parsed from the file
     */
    public static async createFromPath(filePath: Uri): Promise<XxxxFile | undefined> {
        // Create and initialize object
        try {
            const xmlFile = new XxxxFile(filePath);
            await xmlFile._initialize();
            return xmlFile;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to read XXXX file from path '${filePath.fsPath}': ${error.message}`); //TODO uri log #33
            } else {
                logger.error(`Failed to read XXXX file from path '${filePath.fsPath}'`); //TODO uri log #33
            }
            logger.debug('Error details:', { error });
            return undefined;
        }
    }

    /** Object is not ready to use after constructor due to async operations,
     * _initialize() has to be called for the object to be ready to use! */
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
        //TODO
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** XXXXXX */
    public get xxxxx(): string {
        if (!this.#isInitialized || !this.#xxxxx) { throw new Error(`Use of not initialized ${XxxxFile.name} object`); }
        return this.#xxxxx;
    }
    #xxxxx: string | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        const obj = super.toJSON();
        obj.xxxxx = this.xxxxx;
        //TODO
        return obj;
    }
}