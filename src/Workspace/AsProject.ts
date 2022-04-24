import * as vscode from 'vscode';
import { pathJoin, uriToSingleFilePattern, exists, isSubOf, pathsFromTo } from '../Tools/UriTools';
import { logger } from '../Tools/Logger';
import { AsProjectFile } from './Files/AsProjectFile';
import { AsProjectConfiguration } from './AsProjectConfiguration';
import { UserSettingsFile } from './Files/UserSettingsFile';
import { AsProjectPaths } from './AsProjectPaths';
import { AsProjectCBuildInfo, mergeAsProjectCBuildInfo } from '../Environment/AsProjectCBuildData';
import { AsProjectLogical } from './AsProjectLogical';
import { Environment } from '../Environment/Environment';

/**
 * Representation of an Automation Studio project
 */
export class AsProject implements vscode.Disposable {

    /**
     * Creates an Automation Studio project object from the path to the project file
     * @param projectFilePath The path to the project file. e.g. `C:\Projects\Test\Test.apj`
     * @returns The complete project representation or `undefined` of a critical error occured
     */
    public static async createFromProjectFile(projectFilePath: vscode.Uri): Promise<AsProject | undefined> {
        // Create and initialize object
        try {
            const project = new AsProject(projectFilePath);
            await project.#initialize();
            logger.info(`Project '${project.name}' found in '${project.paths.projectRoot.toString(true)}'`);
            return project;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to parse project in path '${projectFilePath.toString(true)}': ${error.message}`);
            } else {
                logger.error(`Failed to parse project in path '${projectFilePath.toString(true)}'`);
            }
            return undefined;
        }
    }

    /** Object is not ready to use after constructor due to async operations,
     * #initialize() has to be called for the object to be ready to use! */
    private constructor(projectFilePath: vscode.Uri) {
        this.#paths = new AsProjectPaths(projectFilePath);
        // other properties rely on async and will be initialized in #initialize()
    }

    /** Async operations to finalize object construction */
    async #initialize(): Promise<void> {
        // get project file
        this.#projectFile = await AsProjectFile.createFromPath(this.#paths.projectFile);
        if (!this.#projectFile) {
            throw new Error('Project file could not be parsed');
        }
        this.#name = this.#projectFile.projectName;
        this.#description = this.#projectFile.projectDescription;
        this.#workingVersion = this.#projectFile.workingVersion;
        // parse logical view
        const logicalPkgPath = pathJoin(this.#paths.logical, 'Package.pkg');
        this.#logical = await AsProjectLogical.createFromPackage(logicalPkgPath, this.#paths.projectRoot);
        if (!this.#logical) {
            throw new Error('Logical View contents could not be parsed');
        }
        // get configurations
        const physicalPkgPath = pathJoin(this.#paths.physical, 'Physical.pkg');
        this.#configurations = await AsProjectConfiguration.createFromPhysicalPkg(physicalPkgPath, this.#paths.projectRoot);
        if (this.#configurations.length === 0) {
            logger.warning(`No configurations found in project ${this.#name}`);
        }
        // apply active configuration and register listener for change
        this.#userSettingsPath = pathJoin(this.#paths.projectRoot, 'LastUser.set');
        this.#activeConfiguration = await this.#getActiveConfiguration();
        const userSetWatcher = vscode.workspace.createFileSystemWatcher(uriToSingleFilePattern(this.#userSettingsPath));
        this.#disposables.push(userSetWatcher);
        userSetWatcher.onDidChange(async () => {
            this.activeConfiguration = await this.#getActiveConfiguration();
        });
        userSetWatcher.onDidCreate(async () => {
            this.activeConfiguration = await this.#getActiveConfiguration();
        });
        userSetWatcher.onDidDelete(async () => {
            this.activeConfiguration = await this.#getActiveConfiguration();
        });
        //
        //TODO
        // init done
        this.#isInitialized = true;
    }
    #isInitialized = false;

    /** The name of the project */
    public get name(): string {
        if (!this.#isInitialized || !this.#name) { throw new Error(`Use of not initialized object`); }
        return this.#name;
    }
    #name: string | undefined;

    /** Description of the project */
    public get description(): string | undefined {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#description;
    }
    #description: string | undefined;

    /** The working version of Automation Studio which is used for this project */
    public get workingVersion(): string | undefined {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#workingVersion;
    }
    #workingVersion: string | undefined;

    /** General paths of the project */
    public get paths(): AsProjectPaths {
        return this.#paths;
    }
    #paths: AsProjectPaths;

    /** Representation of Logical View contents */
    public get logical(): AsProjectLogical {
        if (!this.#isInitialized || !this.#logical) { throw new Error(`Use of not initialized object`); }
        return this.#logical;
    }
    #logical: AsProjectLogical | undefined;

    /** Configurations located in the project */
    public get configurations(): AsProjectConfiguration[] {
        if (!this.#isInitialized || !this.#configurations) { throw new Error(`Use of not initialized object`); }
        return this.#configurations;
    }
    #configurations: AsProjectConfiguration[] | undefined;

    /** The active configuration */
    public get activeConfiguration(): AsProjectConfiguration | undefined {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        return this.#activeConfiguration;
    }
    private set activeConfiguration(value: AsProjectConfiguration | undefined) {
        this.#activeConfiguration = value;
        if (this.#isInitialized) {
            this.#activeConfigurationChangedEmitter.fire(this.activeConfiguration);
        }
    }
    #activeConfiguration: AsProjectConfiguration | undefined;
    #activeConfigurationChangedEmitter = new vscode.EventEmitter<AsProjectConfiguration | undefined>();
    public onActiveConfigurationChanged = this.#activeConfigurationChangedEmitter.event;

    /** All project level build options for C programs and libraries (including general build options) */
    public get cBuildInfo(): AsProjectCBuildInfo {
        if (!this.#isInitialized) { throw new Error(`Use of not initialized object`); }
        //TODO add all default stuff for AS project
        //TODO do not create here on every get call, initialize private field '#cBuildInfo' during init and return that one
        const options: string[] = [];
        if (this.#projectFile?.cCodeOptions.enableDefaultIncludes) {
            options.push('-D', '_DEFAULT_INCLUDES');
        }
        options.push(...this.#defaultCompilerArgs);
        return {
            compilerPath: undefined,
            systemIncludes: [],
            userIncludes: [this.paths.tempIncludes],
            buildOptions: options,
        };
    }

    #projectFile: AsProjectFile | undefined;
    #userSettingsPath: vscode.Uri | undefined;
    #disposables: vscode.Disposable[] = [];

    /** Standard compiler arguments for AS projects */
    readonly #defaultCompilerArgs = [
        //TODO are the default args somwhere in a config file?
        '-fPIC',
        '-O0',
        '-g',
        '-Wall',
        //'-ansi', // if this is used, initializer lists in C++ lead to an error from C/C++ extension, even though a build in AS works (e.g. std::vector<int> v = {1, 2, 42})
        '-D',
        '_SG4', //TODO this -D _SG4 should come from the configuration, depending on the system generation
        '-D',
        '_BUR_FORMAT_BRELF' //TODO investigate if this define needs to be called for all gcc versions / targets (bur/plc.h)
    ];

    /** Dispose all allocated resources */
    public dispose() {
        for (const disposable of this.#disposables) {
            disposable.dispose();
        }
    }

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            name: this.name,
            description: this.description,
            workingVersion: this.workingVersion,
            paths: this.paths,
            logical: this.logical,
            configurations: this.configurations,
            activeConfiguration: this.activeConfiguration,
            cBuildInfo: this.cBuildInfo,
        };
    }

    /**
     * Checks if a given URI is within this AS project
     * @param uri URI to check
     * @returns `true` if the URI is within the AS project, `false` otherwise
     */
    public uriIsInProject(uri: vscode.Uri): boolean {
        return isSubOf(this.paths.projectRoot, uri);
    }

    /**
     * Get all C/C++ build information for a specific file within the project
     * @param uri URI of the file for which the build data will be returned
     * @returns All data for C/C++ build, or `undefined` if the URI is not within this AS project
     */
    public async getCBuildInfo(uri: vscode.Uri): Promise<AsProjectCBuildInfo | undefined> {
        // return if URI is not in project
        if (!this.uriIsInProject(uri)) {
            return undefined;
        }
        // collect build info
        const prjData = this.cBuildInfo;
        const pouData = this.#getCBuildDataForPou(uri);
        const configData = this.activeConfiguration?.cBuildInfo;
        const gccData = (await Environment.automationStudio.getVersion(this.workingVersion))
            ?.gccInstallation.getExecutable(this.activeConfiguration?.gccVersion, 'SG4', 'Arm')?.cBuildInfo; //TODO get target system and architecture
        // merge build info from all sources
        return mergeAsProjectCBuildInfo(prjData, pouData, configData, gccData);
    }

    /**
     * Checks if the URI is within a POU of this AS project. If the URI is within a POU, specific build
     * info for the POU is returned
     * @param uri URI of the file for which build data will be returned
     * @returns Build information specific for the POU if the URI is within a POU, or `undefined` if the URI is not within a POU
     */
    #getCBuildDataForPou(uri: vscode.Uri): AsProjectCBuildInfo | undefined {
        //TODO extract POU build data getter to another place within this class or separate class
        //     for the POU build data multiple things are needed (mostly for programs only):
        //     - Prj base paths to generate AsDefault.h include tree in proper order (prg only) -> Done
        //     - Cpu.sw information of active config to get POU specific defines / includes
        //     - mapp Component information for mapp global variables headers (prg only) -> Call done, implementation not here
        //     - Configuration view global variables (rarely used) (prg only) -> Call done, implementation not here

        // get POU and return if there is no macth
        const pou = this.logical.getPou(uri);
        if (pou === undefined) {
            return undefined;
        }
        // collect data depending on POU type
        switch (pou.type) {
            case 'program': {
                // for programs, the IEC declaration file tree is 'cloned' to a header file tree in the 'Temp/Includes' directory
                const iecIncludeDirs = pathsFromTo(this.paths.logical, pou.rootPath, this.paths.tempIncludes);
                iecIncludeDirs.reverse(); // highest folder level needs to be searched first on include
                const iecBuildInfo: AsProjectCBuildInfo = {
                    compilerPath: undefined,
                    systemIncludes: [],
                    userIncludes: iecIncludeDirs,
                    buildOptions: [],
                };
                // add also globals from configuration view and return
                return mergeAsProjectCBuildInfo(iecBuildInfo, this.activeConfiguration?.cBuildInfoGlobals);
            }
        
            default:
                // no special POU includes for other POU types
                return undefined;
        }
    }

    async #getActiveConfiguration(): Promise<AsProjectConfiguration | undefined> {
        const defaultConfig = this.#configurations?.[0];
        if (!this.#userSettingsPath) {
            return defaultConfig;
        }
        if (!exists(this.#userSettingsPath)) {
            return defaultConfig;
        }
        const userSetttings = await UserSettingsFile.createFromPath(this.#userSettingsPath);
        const activeConfig = this.#configurations?.find((cfg) => cfg.name === userSetttings?.activeConfiguration);
        return activeConfig ?? defaultConfig;
    }
}