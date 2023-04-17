/**
 * Handling of installed PVI versions on the developer PC
 * @packageDocumentation
*/

import * as vscode from 'vscode';
import { logger } from '../Tools/Logger';
import * as semver from 'semver';
import { extensionConfiguration } from '../ExtensionConfiguration';
import { getMatchingVersion } from '../Tools/SemVer';
import { PviVersion } from './PviVersion';
import { AutomationStudioVersion } from './AutomationStudioVersion';
import { statusBar } from '../UI/StatusBar';


export class Environment {

    /** static only class */
    private constructor() { }

    /** PVI (Process Variable Interface) environment */
    public static pvi = class {

        /** static only class */
        private constructor() { }

        /**
         * Get all available PVI versions
         * @returns All available PVI versions
         */
        public static async getVersions(): Promise<PviVersion[]> {
            if (this.#versions === undefined) {
                this.#versions = this.#searchVersions();
                statusBar.addBusyItem(this.#versions, 'Searching for installed PVI versions');
            }
            return await this.#versions;
        }

        /**
         * Get a specific Pvi version object. If used in non strict mode, the highest available version will be returned.
         * @param version The requested version which should be prefered. Can be set to `undefined` if any version is ok
         * @param strict Only return a Pvi with same major.minor version. Defaults to `false`
         * @returns A `Pvi` version which fullfills the request or `undefined` if no such version was found
         */
        public static async getVersion(version?: semver.SemVer | string, strict = false): Promise<PviVersion | undefined> {
            const versions = await this.getVersions();
            return getMatchingVersion(versions, version, strict);
        }

        /**
         * Starts a new search for PVI versions in the configured directories and updates the internal list.
         * @returns All available PVI versions after update
         */
        public static async updateVersions(): Promise<PviVersion[]> {
            this.#versions = this.#searchVersions();
            statusBar.addBusyItem(this.#versions, 'Searching for installed PVI versions');
            return await this.#versions;
        }
        static async #searchVersions(): Promise<PviVersion[]> {
            logger.info('Start searching for PVI versions');
            // search for PVI installations in all configured directories
            const foundVersions: PviVersion[] = [];
            const configuredDirs = extensionConfiguration.environment.pviInstallPaths;
            for (const configDir of configuredDirs) {
                logger.info(`Searching for PVI versions in ${logger.formatUri(configDir)}.`);
                const versionsInDir = await PviVersion.searchVersionsInDir(configDir);
                foundVersions.push(...versionsInDir);
            }
            // done
            if (foundVersions.length > 0) {
                logger.info(`Searching for PVI versions done, ${foundVersions.length} versions found`);
            } else {
                logger.warning(`No PVI versions found. Some functionality will not be available.`);
            }
            return foundVersions;
        }
        static #versions: Promise<PviVersion[]> | undefined;
    };

    /** Automation Studio environment */
    public static automationStudio = class {

        /** static only class */
        private constructor() { }

        /**
         * Get all available Automation Studio versions
         * @returns All available Automation Studio versions
         */
        public static async getVersions(): Promise<AutomationStudioVersion[]> {
            if (this.#versions === undefined) {
                this.#versions = this.#searchVersions();
                statusBar.addBusyItem(this.#versions, 'Searching for installed AS versions');
            }
            return await this.#versions;
        }

        /**
         * Get a specific Automation Studio version object. If used in non strict mode, the highest available version will be returned.
         * @param version The requested version which should be prefered. Can be set to `undefined` if any version is ok
         * @param strict Only return an Automation Studio with same major.minor version. Defaults to `false`
         * @returns An Automation Studio version which fullfills the request or `undefined` if no such version was found
         */
        public static async getVersion(version?: semver.SemVer | string, strict = false): Promise<AutomationStudioVersion | undefined> {
            const versions = await this.getVersions();
            return getMatchingVersion(versions, version, strict);
        }

        /**
         * Starts a new search for Automation Studio versions in the configured directories and updates the internal list.
         * @returns All available Automation Studio versions after update
         */
        public static async updateVersions(): Promise<AutomationStudioVersion[]> {
            this.#versions = this.#searchVersions();
            statusBar.addBusyItem(this.#versions, 'Searching for installed AS versions');
            return await this.#versions;
        }
        static async #searchVersions(): Promise<AutomationStudioVersion[]> {
            logger.info('Start searching for Automation Studio versions');
            // search for Automation Studio installations in all configured directories
            const foundVersions: AutomationStudioVersion[] = [];
            const configuredDirs = extensionConfiguration.environment.automationStudioInstallPaths;
            for (const configDir of configuredDirs) {
                logger.info(`Searching for Automation Studio versions in ${logger.formatUri(configDir)}.`);
                const versionsInDir = await AutomationStudioVersion.searchVersionsInDir(configDir);
                foundVersions.push(...versionsInDir);
            }
            // done
            if (foundVersions.length > 0) {
                logger.info(`Searching for Automation Studio versions done, ${foundVersions.length} versions found`);
            } else {
                logger.warning(`No Automation Studio versions found. Some functionality will not be available.`);
            }
            return foundVersions;
        }
        static #versions: Promise<AutomationStudioVersion[]> | undefined;
    };
}