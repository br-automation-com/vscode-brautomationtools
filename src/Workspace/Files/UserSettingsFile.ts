import { Uri } from 'vscode';
import { logger } from '../../Tools/Logger';
import { getChildElements } from '../../Tools/XmlDom';
import { AsXmlFile } from './AsXmlFile';

/**
 * User specific project settings file (*.set in the project root)
 */
export class UserSettingsFile extends AsXmlFile {

    /**
     * Creates a user settings file from a specified URI to the file
     * @param filePath The user settings file path. e.g. `C:\Projects\Test\LastUser.set`
     * @returns The file which was parsed from the file URI
     */
    public static async createFromPath(filePath: Uri): Promise<UserSettingsFile | undefined> {
        // Create and initialize object
        try {
            const xmlFile = new UserSettingsFile(filePath);
            await xmlFile._initialize();
            return xmlFile;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to read user settings file from path '${filePath.fsPath}': ${error.message}`);
            } else {
                logger.error(`Failed to read user settings file from path '${filePath.fsPath}'`);
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
        // get active configuration
        const configMngElement = getChildElements(this.rootElement, 'ConfigurationManager').pop();
        this.#activeConfiguration = configMngElement?.getAttribute('ActiveConfigurationName') ?? undefined;
        // get deployment target
        const deploymentElement = getChildElements(this.rootElement, 'Deployment').pop();
        this.#deploymentTarget = deploymentElement?.getAttribute('Value') ?? undefined;
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** The name of the active configuration */
    public get activeConfiguration(): string | undefined {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized ${UserSettingsFile.name} object`); }
        return this.#activeConfiguration;
    }
    #activeConfiguration: string | undefined;

    /** Deployment target for newly added programs (e.g. active configuration) */
    public get deploymentTarget(): string | undefined {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized ${UserSettingsFile.name} object`); }
        return this.#deploymentTarget;
    }
    #deploymentTarget: string | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        const obj = super.toJSON();
        obj.activeConfiguration = this.activeConfiguration;
        obj.deploymentTarget = this.deploymentTarget;
        return obj;
    }
}