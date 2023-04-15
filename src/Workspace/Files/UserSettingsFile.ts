import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { logger } from '../../Tools/Logger';
import { AsXmlFileNew } from './AsXmlFileNew';

/**
 * User specific project settings file representation (*.set in the project root)
 */
export class UserSettingsFile extends AsXmlFileNew {

    /**
     * Creates a user settings file representation from a specified URI to the file
     * @param filePath The user settings file path. e.g. `C:\Projects\Test\LastUser.set`
     * @returns The user settings file representation which was parsed from the file
     */
    public static async createFromPath(filePath: Uri): Promise<UserSettingsFile | undefined> {
        // Create and initialize object
        try {
            const textDoc = await vscode.workspace.openTextDocument(filePath);
            const fileContent = textDoc.getText();
            return new UserSettingsFile(filePath, fileContent);
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to read user settings file from path "${filePath.fsPath}": ${error.message}`); //TODO uri log #33
            } else {
                logger.error(`Failed to read user settings file from path "${filePath.fsPath}"`); //TODO uri log #33
            }
            logger.debug('Error details:', { error });
            return undefined;
        }
    }

    /** TODO doc */
    protected constructor(filePath: Uri, fileContent: string) {
        super(filePath, fileContent);
        const rootAny = this.xmlRootObj as any;
        // get active configuration
        const activeConfiguration = rootAny?.ConfigurationManager?._att?.ActiveConfigurationName as unknown;
        this.#activeConfiguration = typeof activeConfiguration === 'string' ? activeConfiguration : undefined;
        // get deployment target
        const deploymentTarget = rootAny?.Deployment?._att?.Value as unknown;
        this.#deploymentTarget = typeof deploymentTarget === 'string' ? deploymentTarget : undefined;
    }

    /** The name of the active configuration */
    public get activeConfiguration(): string | undefined {
        return this.#activeConfiguration;
    }
    #activeConfiguration: string | undefined;

    /** Deployment target for newly added programs (e.g. active configuration) */
    public get deploymentTarget(): string | undefined {
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