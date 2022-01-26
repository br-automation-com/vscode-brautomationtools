/**
 * Interface to the [ms-vscode.cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) extension.
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import * as cppTools from 'vscode-cpptools';
import * as BRAsProjectWorkspace from '../Workspace/BRAsProjectWorkspace';
import { logger } from '../Tools/Logger';
import * as Helpers from '../Tools/Helpers';
import * as uriTools from '../Tools/UriTools';
import { Environment } from '../Environment/Environment';


/**
 * Register the custom configuration provider on the C/C++ Tools extension
 */
export async function registerCppToolsConfigurationProvider(context: vscode.ExtensionContext): Promise<void> {
    const provider = CppConfigurationProvider.getInstance();
    context.subscriptions.push(provider);
    await provider.initialize();
}


// HACK to try out change of provider config quick and dirty. Figure out in #5 architectural changes.
// Works well -> implement properly
export async function didChangeCppToolsConfig() {
    CppConfigurationProvider.getInstance().didChangeCppToolsConfig();
}


/**
 * The actual class that provides information to the cpptools extension. See
 * the `CustomConfigurationProvider` interface for information on how this class
 * should be used.
 */
class CppConfigurationProvider implements cppTools.CustomConfigurationProvider {
    static #instance: CppConfigurationProvider = new CppConfigurationProvider();
    public static getInstance(): CppConfigurationProvider {
        return this.#instance;
    }

    private constructor() {
    }

    async initialize(): Promise<boolean> {
        this.#cppApi = await cppTools.getCppToolsApi(cppTools.Version.v5);
        if (!this.#cppApi) {
            logger.error('Failed to connect to C/C++ extension (API V5). C/C++ extension is not installed or version is not supported.');
            return false;
        }
        this.#cppApi.registerCustomConfigurationProvider(this);
        // Ready only parsing of workspace and environment (required for proper includes)
        Environment.automationStudio.getVersions().then(() => this.didChangeCppToolsConfig());
        BRAsProjectWorkspace.getWorkspaceProjects().then(() => this.didChangeCppToolsConfig());
        this.#cppApi.notifyReady(this);
        return true;
    }

    didChangeCppToolsConfig() {
        this.#cppApi?.didChangeCustomConfiguration(this);
    }

    #cppApi: cppTools.CppToolsApi | undefined;

    //#region cppTools.CustomConfigurationProvider interface implementation

    // Our name and extension ID visible to cpptools
    //SYNC needs to be in sync with package.json/name and package.json/displayName
    readonly name = 'B&R Automation Tools';
    readonly extensionId = 'vscode-brautomationtools';


    async canProvideConfiguration(uri: vscode.Uri): Promise<boolean> {
        // Check if file is within an AS project
        const asProject = await BRAsProjectWorkspace.getProjectForUri(uri);
        let canProvide = false;
        if (!asProject) {
            canProvide = false;
        } else {
            // Only files in logical view can provide info
            //TODO is it also required for headers in Temp?
            canProvide = uriTools.isSubOf(asProject.logical, uri);
        }
        logger.debug('CppConfigurationProvider.canProvideConfiguration(uri)', { uri: uri.toString(true), return: canProvide });
        return canProvide;
    }


    async provideConfigurations(uris: vscode.Uri[], token?: vscode.CancellationToken): Promise<cppTools.SourceFileConfigurationItem[]> {
        const configs = await Promise.all( uris.map((uri) => this._getConfiguration(uri) ) );
        const validConfigs: cppTools.SourceFileConfigurationItem[] = [];
        Helpers.pushDefined(validConfigs, ...configs);
        const logData = {
            uris: uris.map((uri) => uri.toString(true)),
            return: validConfigs,
            numRequested: uris.length,
            numResults: validConfigs.length
        };
        logger.debug('CppConfigurationProvider.provideConfigurations(uris)', logData);
        return validConfigs;
    }


    //TODO Investigate if BrowseConfiguration is required or more performant than separate configurations
    // According to https://code.visualstudio.com/docs/cpp/c-cpp-properties-schema-reference 'includePath' is used for most features.
    // Currently 'browse.path' used is still by the C/C++ extension when no compiler is present, but in future versions 'includePath'
    // will be also used in this situation.
    async canProvideBrowseConfiguration(): Promise<boolean> { return false; }
    async provideBrowseConfiguration(): Promise<cppTools.WorkspaceBrowseConfiguration> { return { browsePath: [] }; }
    async canProvideBrowseConfigurationsPerFolder(): Promise<boolean> { return false; }
    async provideFolderBrowseConfiguration(_uri: vscode.Uri): Promise<cppTools.WorkspaceBrowseConfiguration> { return { browsePath: [] }; }


    //#endregion cppTools.CustomConfigurationProvider interface implementation


    //#region fields

    /** Standard compiler arguments */
    private readonly defaultCompilerArgs = [
        //TODO are the default args somwhere in a config file?
        '-fPIC',
        '-O0',
        '-g',
        '-Wall',
        //'-ansi', // if this is used, initializer lists in C++ lead to an error from C/C++ extension, even though a build in AS works (e.g. std::vector<int> v = {1, 2, 42})
        '-D',
        '_DEFAULT_INCLUDES',
        '-D',
        '_SG4',
        '-D',
        '_BUR_FORMAT_BRELF' //TODO investigate if this define needs to be called for all gcc versions (bur/plc.h)
    ];


    //#endregion fields


    /**
     * Get the SourceFileConfigurationItem for the given URI
     * @param uri The uri to get the configuration from
     */
    private async _getConfiguration(uri: vscode.Uri): Promise<cppTools.SourceFileConfigurationItem | undefined> {
        // get project include directories
        const headerUris = await BRAsProjectWorkspace.getProjectHeaderIncludeDirs(uri);
        const headerPaths = headerUris.map((u) => u.fsPath);
        // get project info for further queries and check required properties
        const asProjectInfo = await BRAsProjectWorkspace.getProjectForUri(uri);
        if (!asProjectInfo) {
            return undefined;
        }
        const activeCfg = asProjectInfo.activeConfiguration;
        if (!activeCfg?.buildSettings.gccVersion) {
            return undefined;
        }
        // get gcc data
        const gccExe = (await Environment.automationStudio.getVersion(asProjectInfo.asVersion))
            ?.gccInstallation.getExecutable(activeCfg.buildSettings.gccVersion, 'SG4', 'Arm');
        if (!gccExe) {
            return undefined;
        }
        // get compiler arguments
        const compilerArgs = this.defaultCompilerArgs;
        compilerArgs.push(...activeCfg.buildSettings.additionalBuildOptions);
        compilerArgs.push(...activeCfg.buildSettings.ansiCAdditionalBuildOptions);
        // create and return C/C++ configuration
        const config: cppTools.SourceFileConfigurationItem = {
            uri: uri,
            configuration: {
                includePath:      headerPaths,
                defines:          [],
                intelliSenseMode: undefined,
                standard:         undefined,
                compilerArgs:     compilerArgs,
                compilerPath:     gccExe.exePath.fsPath,
            }
        };
        return config;
    }


    /** Dispose all disposable resources */
    dispose() {
        this.#cppApi?.dispose();
    }


    /**
     * Version of Cpptools API
     */
    #cpptoolsVersion: cppTools.Version = cppTools.Version.v5;
    /**
     * Gets the version of Cpptools API.
     */
    get cpptoolsVersion(): cppTools.Version {
        return this.#cpptoolsVersion;
    }
}