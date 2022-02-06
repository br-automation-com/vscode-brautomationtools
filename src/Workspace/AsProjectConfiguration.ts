import * as vscode from 'vscode';
import * as uriTools from '../Tools/UriTools';
import * as semver from 'semver';
import { logger } from '../Tools/Logger';
import { ConfigPackageFile } from './Files/ConfigPackageFile';
import { CpuPackageFile } from './Files/CpuPackageFile';

/**
 * Representation of an Automation Studio project configuration version
 */
export class AsProjectConfiguration {

    /**
     * Creates an configuration from a specified root directory
     * @param configRoot The root directory of the configuration. e.g. `C:\Projects\Test\Physical\Config1`
     * @param projectRoot The root directory of the AS project of the configuration. e.g. `C:\Projects\Test`
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
                logger.error(`Failed to parse project configuration in path '${configRoot.fsPath}': ${error.message}`);
            } else {
                logger.error(`Failed to parse project configuration in path '${configRoot.fsPath}'`);
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

    /** The root URI of the configuration version */
    public get rootPath(): vscode.Uri {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#rootPath;
    }
    #rootPath: vscode.Uri;

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
    
    /** Include directories for C programs and libraries */
    public get cIncludeDirectories(): vscode.Uri[] {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#cpuPkg?.cpuConfig.build.resolveAnsiCIncludeDirs(this.#projectRoot) ?? [];
    }

    /** All build options for C programs and libraries (including general build options) */
    public get cBuildOptions(): string[] {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        const general = this.#cpuPkg?.cpuConfig.build.additionalBuildOptions ?? [];
        const cOnly = this.#cpuPkg?.cpuConfig.build.ansiCAdditionalBuildOptions ?? [];
        return general.concat(cOnly);
    }

    /** All build options for IEC programs and libraries (including general build options) */
    public get iecBuildOptions(): string[] {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        const general = this.#cpuPkg?.cpuConfig.build.additionalBuildOptions ?? [];
        const iecOnly = this.#cpuPkg?.cpuConfig.build.iecAdditionalBuildOptions ?? [];
        return general.concat(iecOnly);
    }

    /** Name of the CPU package
     * @deprecated
     */
    public get cpuPackageName() : string | undefined {
        //TODO, this property is currently used by the BrAsTransferTaskProvider to get the location of the RUC package
        //      remove poperty and provide the RUC package path directly (not sure if from here or from some other place)
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#configPkg?.cpuChildObject.path;
    }

    #projectRoot: vscode.Uri;
    #configPkg: ConfigPackageFile | undefined;
    #cpuPkg: CpuPackageFile | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            rootPath: this.rootPath.toString(true),
            plcModuleId: this.plcModuleId,
            arVersion: this.arVersion,
            gccVersion: this.gccVersion,
            cIncludeDirectories: this.cIncludeDirectories.map((uri) => uri.toString(true)),
            cBuildOptions: this.cBuildOptions,
            iecBuildOptions: this.iecBuildOptions,
        };
    }
}