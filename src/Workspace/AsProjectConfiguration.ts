import * as vscode from 'vscode';
import * as uriTools from '../Tools/UriTools';
import { logger } from '../Tools/Logger';
import { ConfigPackageFile } from './Files/ConfigPackageFile';
import { CpuPackageFile } from './Files/CpuPackageFile';
import { AsPackageFile } from './Files/AsPackageFile';
import { AsProjectCBuildInfo } from '../Environment/AsProjectCBuildData';

/**
 * Representation of an Automation Studio project configuration
 */
export class AsProjectConfiguration {

    /**
     * Creates objects for all configurations of a project from the physical package file
     * @param physicalPkgPath The path to the physical package file. e.g. `C:\Projects\Test\Physical\Physical.pkg`
     * @param projectRoot The root directory of the AS project containing the configuration. e.g. `C:\Projects\Test`
     * @returns All configurations which were parsed from the physical package file.
     */
    public static async createFromPhysicalPkg(physicalPkgPath: vscode.Uri, projectRoot: vscode.Uri): Promise<AsProjectConfiguration[]> {
        // get package file and return empty if failed
        const physicalPkg = await AsPackageFile.createFromPath(physicalPkgPath);
        if (physicalPkg === undefined) {
            return [];
        }
        // create configuration for each Configuration element
        const configChildren = physicalPkg.getChildrenOfType('Configuration');
        const configurations: AsProjectConfiguration[] = [];
        for (const configChild of configChildren) {
            const configRoot = configChild.resolvePath(projectRoot);
            const config = await this.createFromDir(configRoot, projectRoot, configChild.description);
            if (config !== undefined) {
                configurations.push(config);
            }
        }
        return configurations;
    }

    /**
     * Creates an configuration from a specified root directory
     * @param configRoot The root directory of the configuration. e.g. `C:\Projects\Test\Physical\Config1`
     * @param projectRoot The root directory of the AS project containing the configuration. e.g. `C:\Projects\Test`
     * @returns The configuration which was parsed from the root URI
     */
    public static async createFromDir(configRoot: vscode.Uri, projectRoot: vscode.Uri, description?: string | undefined): Promise<AsProjectConfiguration | undefined> {
        // Create and initialize object
        try {
            const config = new AsProjectConfiguration(configRoot, projectRoot, description);
            await config.#initialize();
            logger.detail(`Project configuration found in '${config.rootPath.toString(true)}'`);
            return config;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to parse project configuration in path '${configRoot.toString(true)}': ${error.message}`);
            } else {
                logger.error(`Failed to parse project configuration in path '${configRoot.toString(true)}'`);
            }
            return undefined;
        }
    }

    /** Object is not ready to use after constructor due to async operations,
     * #initialize() has to be called for the object to be ready to use! */
    private constructor(configRoot: vscode.Uri, projectRoot: vscode.Uri, description?: string | undefined) {
        this.#rootPath = configRoot;
        this.#projectRoot = projectRoot;
        this.#name = uriTools.pathBasename(configRoot);
        this.#description = description;
        // other properties rely on async and will be initialized in #initialize()
    }

    /** Async operations to finalize object construction */
    async #initialize(): Promise<void> {
        // Get mandatory main configuration package
        const configPkgPath = uriTools.pathJoin(this.#rootPath, 'Config.pkg');
        this.#configPkg = await ConfigPackageFile.createFromPath(configPkgPath);
        if (!this.#configPkg) {
            throw new Error('TODO message'); //TODO message
        }
        // Get optional cpu package
        const cpuRootPath = this.#configPkg.cpuChildObject.resolvePath(this.#projectRoot);
        const cpuPkgPath = uriTools.pathJoin(cpuRootPath, 'Cpu.pkg');
        this.#cpuPkg = await CpuPackageFile.createFromPath(cpuPkgPath);
        //TODO
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** The root URI of the configuration */
    public get rootPath(): vscode.Uri {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#rootPath;
    }
    #rootPath: vscode.Uri;

    /**
     * The path offset to the configuration data within temporary and binary paths `'<ConfigName>/<CpuPkgName>'`
     * Can be used in combination with path join to get binary output, ArSim, ... directories of the configuration
     * Can be undefined if some of the configuration source files have missing attributes.
     */
    public get outPathOffset(): string | undefined {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        const cpuPath = this.#configPkg?.cpuChildObject.path;
        if (cpuPath === undefined) {
            return undefined;
        }
        return `${this.name}/${cpuPath}`;
    }

    /** The name of the configuration */
    public get name(): string {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#name;
    }
    #name: string;

    /** Description of the configuration */
    public get description(): string | undefined {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#description;
    }
    #description: string | undefined;

    /** Module ID of the configured PLC */
    public get plcModuleId(): string | undefined {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#cpuPkg?.cpuConfig.cpuModuleId;
    }

    /** Automation Runtime version used in the configuration */
    public get arVersion(): string | undefined {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#cpuPkg?.cpuConfig.arVersion;
    }

    /** gcc version used in the configuration */
    public get gccVersion(): string | undefined {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#cpuPkg?.cpuConfig.build.gccVersion;
    }
    
    /** Configuration level include directories for C programs and libraries */
    public get cIncludeDirectories(): vscode.Uri[] {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#cpuPkg?.cpuConfig.build.resolveAnsiCIncludeDirs(this.#projectRoot) ?? [];
    }

    /** All configuration level build options for C programs and libraries (including general build options) */
    public get cBuildOptions(): string[] {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        const general = this.#cpuPkg?.cpuConfig.build.additionalBuildOptions ?? [];
        const cOnly = this.#cpuPkg?.cpuConfig.build.ansiCAdditionalBuildOptions ?? [];
        return general.concat(cOnly);
    }

    /** All general configuration level build information for C-Code */
    public get cBuildInfo(): AsProjectCBuildInfo {
        //TODO remove 'cIncludeDirectories' and 'cBuildOptions' properties?
        //TODO do not build option here, set in initializer or otherwise change to a method instead of a property
        return {
            compilerPath: undefined, //TODO get gcc from environment here?
            systemIncludes: [],
            userIncludes: this.cIncludeDirectories,
            buildOptions: this.cBuildOptions,
        };
    }

    /**
     * C-Code build info for configuration level globals, such as mapp Links, Axes and configuration variable files.
     * These are separate from the general build info, as globals can only be used within programs, but not in libraries...
     */
    public get cBuildInfoGlobals(): AsProjectCBuildInfo {
        //TODO collect locations of generated MpLink... headers
        return {
            compilerPath: undefined,
            systemIncludes: [],
            userIncludes: [],
            buildOptions: [],
        };
    }

    /** All configuration level build options for IEC programs and libraries (including general build options) */
    public get iecBuildOptions(): string[] {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        const general = this.#cpuPkg?.cpuConfig.build.additionalBuildOptions ?? [];
        const iecOnly = this.#cpuPkg?.cpuConfig.build.iecAdditionalBuildOptions ?? [];
        return general.concat(iecOnly);
    }

    #projectRoot: vscode.Uri;
    #configPkg: ConfigPackageFile | undefined;
    #cpuPkg: CpuPackageFile | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            rootPath: this.rootPath.toString(true),
            outPathOffset: this.outPathOffset,
            name: this.name,
            description: this.description,
            plcModuleId: this.plcModuleId,
            arVersion: this.arVersion,
            gccVersion: this.gccVersion,
            cIncludeDirectories: this.cIncludeDirectories.map((uri) => uri.toString(true)),
            cBuildOptions: this.cBuildOptions,
            iecBuildOptions: this.iecBuildOptions,
        };
    }
}