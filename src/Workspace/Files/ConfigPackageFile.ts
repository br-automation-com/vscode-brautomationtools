import * as vscode from 'vscode';
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
    public static override async createFromFile(filePath: Uri): Promise<ConfigPackageFile | undefined> {
        // Create and initialize object
        try {
            const textDoc = await vscode.workspace.openTextDocument(filePath);
            const fileContent = textDoc.getText();
            return new ConfigPackageFile(filePath, fileContent);
        } catch (error) {
            logger.error(`Failed to read Config package file from path ${logger.formatUri(filePath)}. ${logger.formatError(error)}`);
            return undefined;
        }
    }

    /** TODO doc */
    protected constructor(filePath: Uri, fileContent: string) {
        super(filePath, fileContent);
        // other properties rely on async and will be initialized in #initialize()
        if (this.type !== 'Configuration') {
            throw new Error('Root element name is not <Configuration>');
        }
        let cpuObjects = this.getChildrenOfType('Cpu');
        if (cpuObjects.length === 0) {
            cpuObjects = this.getChildrenOfType('PLC'); // Legacy AS V3.x Config.pkg
            //TODO in this case we also need to use Plc.pkg in the folder level below... -> Currently error when opening
        }
        if (cpuObjects.length > 1) {
            throw new Error('Too many Cpu objects found');
        }
        if (cpuObjects.length < 1) {
            throw new Error('No Cpu object found');
        }
        this.#cpuChildObject = cpuObjects[0];
    }

    /** CPU and build configuration data */
    public get cpuChildObject(): AsPackageObject {
        return this.#cpuChildObject;
    }
    #cpuChildObject: AsPackageObject;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public override toJSON(): Record<string, unknown> {
        const obj = super.toJSON();
        obj.cpuChildObject = this.cpuChildObject;
        return obj;
    }
}