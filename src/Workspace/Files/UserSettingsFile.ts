import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { logger } from '../../Tools/Logger';
import { AsXmlFile } from './AsXmlFile';
import { ParsedXmlObject } from './AsXmlParser';

/**
 * User specific project settings file representation (*.set in the project root)
 */
export class UserSettingsFile extends AsXmlFile {

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
            logger.error(`Failed to read user settings file from path ${logger.formatUri(filePath)}. ${logger.formatError(error)}`);
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
    public set activeConfiguration(value: string | undefined) {
        try {
            setActiveConfiguration(this.xmlRootObj, value);
            this.#activeConfiguration = value;
        } catch (error) {
            logger.error(`Failed to set active configuration in file ${logger.formatUri(this.filePath)}. ${logger.formatError(error)}`);
        }
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

function setActiveConfiguration(xmlRootObj: ParsedXmlObject, activeConfiguration: string | undefined): void {
    //TODO delete property if undefined?
    const rootAny = xmlRootObj as any;
    const configManagerAtt = rootAny?.ConfigurationManager?._att ?? {};
    if (typeof configManagerAtt !== 'object') { throw new Error('ROOT.ConfigurationManager._att is not an object'); }
    configManagerAtt.ActiveConfigurationName = activeConfiguration;
    if (rootAny?.ConfigurationManager === undefined) {
        rootAny.ConfigurationManager = { _att: configManagerAtt };
    } else {
        rootAny.ConfigurationManager._att = configManagerAtt;
    }
}