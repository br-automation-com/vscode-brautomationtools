/**
 * Handling of installed PVI versions on the developer PC
 * @packageDocumentation
*/

import * as vscode from 'vscode';
import { logger } from '../BrLog';
import * as semver from 'semver';
import { extensionConfiguration } from '../BRConfiguration';
import { requestVersion } from './SemVerTools';
import { PviVersion } from './Pvi';


export class Environment {

    /**
     * Get all available PVI versions
     * @returns All available PVI versions
     */
    static async getPviVersions(): Promise<PviVersion[]> {
        if (this.#pviVersions === undefined) {
            this.#pviVersions = await this.updatePviVersions();
        }
        return this.#pviVersions;
    }

    /**
     * Get a specific Pvi version object. If used in non strict mode, the highest available version will be returned.
     * @param versionRequest The requested version which should be prefered. Can be set to `undefined` if any version is ok
     * @param strict Only return a Pvi with same major.minor version. Defaults to `false`
     * @returns A `Pvi` version which fullfills the request or `undefined` if no such version was found
     */
    static async getPviVersion(requested?: semver.SemVer | string, strict = false): Promise<PviVersion | undefined> {
        const versions = await this.getPviVersions();
        return requestVersion(versions, requested, strict);
    }

    /**
     * Starts a new search for PVI versions in the configured directories and updates the internal list.
     * @returns All available PVI versions after update
     */
    static async updatePviVersions(): Promise<PviVersion[]> {
        logger.info('Start searching for PVI versions');
        // search for PVI installations in all configured directories
        const result: PviVersion[] = [];
        const configuredDirs = extensionConfiguration.environment.pviInstallPaths;
        for (const configDir of configuredDirs) {
            logger.info(`Searching for PVI versions in '${configDir.fsPath}'`);
            const versionsInDir = await PviVersion.searchVersionsInDir(configDir);
            result.push(...versionsInDir);
        }
        // done
        logger.info(`Searching for PVI versions done, ${result.length} versions found`);
        this.#pviVersions = result;
        return this.#pviVersions;
    }
    static #pviVersions: PviVersion[] | undefined;

    /** static only class */
    private constructor() { }
}