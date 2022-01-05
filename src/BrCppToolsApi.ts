/**
 * Interface to the [ms-vscode.cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) extension.
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import * as cppTools from 'vscode-cpptools';
import * as BRAsProjectWorkspace from './BRAsProjectWorkspace';
import * as BREnvironment from './BREnvironment';
import { Logger } from './BrLog';
import * as Helpers from './Tools/Helpers';
import * as uriTools from './Tools/UriTools';


/**
 * Register the custom configuration provider on the C/C++ Tools extension
 */
export async function registerCppToolsConfigurationProvider(context: vscode.ExtensionContext): Promise<void> {
    const cppToolsApi = await cppTools.getCppToolsApi(cppTools.Version.v5);
    if (!cppToolsApi) {
        Logger.default.error('Failed to connect to C/C++ extension (API V5). C/C++ extension is not installed or version is not supported.');
        return;
    }
    context.subscriptions.push(cppToolsApi);
    const provider = new CppConfigurationProvider();
    usedProvider = provider; //HACK to try out change of provider config quick and dirty. Figure out in #5 architectural changes.
    context.subscriptions.push(provider);
    cppToolsApi.registerCustomConfigurationProvider(provider);
    // Ready only parsing of workspace and environment (required for proper includes)
    await BREnvironment.getAvailableAutomationStudioVersions();
    await BRAsProjectWorkspace.getWorkspaceProjects();
    cppToolsApi.notifyReady(provider);
}


// HACK to try out change of provider config quick and dirty. Figure out in #5 architectural changes.
// Works well -> implement properly
let usedProvider: CppConfigurationProvider;
export async function didChangeCppToolsConfig() {
    const cppToolsApi = await cppTools.getCppToolsApi(cppTools.Version.v5);
    if (!cppToolsApi) {
        return;
    }
    if (usedProvider) {
        cppToolsApi.didChangeCustomConfiguration(usedProvider);
    }
}


/**
 * The actual class that provides information to the cpptools extension. See
 * the `CustomConfigurationProvider` interface for information on how this class
 * should be used.
 */
export class CppConfigurationProvider implements cppTools.CustomConfigurationProvider {
    //#region cppTools.CustomConfigurationProvider interface implementation

    // Our name and extension ID visible to cpptools
    //SYNC needs to be in sync with package.json/name and package.json/displayName
    readonly name = 'B&R Automation Tools';
    readonly extensionId = 'vscode-brautomationtools';


    async canProvideConfiguration(uri: vscode.Uri): Promise<boolean> {
        // Check if file is within an AS project
        const asProject = await BRAsProjectWorkspace.getProjectForUri(uri);
        if (!asProject) {
            return false;
        } else {
            // Only files in logical view can provide info
            //TODO is it also required for headers in Temp?
            return uriTools.isSubOf(asProject.logical, uri);
        }
    }


    async provideConfigurations(uris: vscode.Uri[], token?: vscode.CancellationToken): Promise<cppTools.SourceFileConfigurationItem[]> {
        for (const uri of uris) {
            Logger.default.debug(`CppConfigurationProvider.provideConfigurations() called for URI "${uri.toString(true)}"`);
        }
        const configs = await Promise.all( uris.map((uri) => this._getConfiguration(uri) ) );
        const validConfigs: cppTools.SourceFileConfigurationItem[] = [];
        Helpers.pushDefined(validConfigs, ...configs);
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
        Logger.default.debug(`CppConfigurationProvider._getConfiguration() called for URI "${uri.toString(true)}"`);
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
        const gccInfo = await BREnvironment.getGccTargetSystemInfo(asProjectInfo.asVersion, activeCfg.buildSettings.gccVersion, 'SG4 Ia32'); //TODO parameter targetSystem not hard coded (#11)
        if (!gccInfo) {
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
                compilerPath:     gccInfo.gccExe.fsPath,
            }
        };
        Logger.default.debug(`CppConfigurationProvider._getConfiguration() called for URI "${uri.toString(true)}" return:`, {data: config});
        return config;
    }


    /** No-op */
    dispose() { }


    /**
     * Version of Cpptools API
     */
    private _cpptoolsVersion: cppTools.Version = cppTools.Version.latest;
    /**
     * Gets the version of Cpptools API.
     */
    get cpptoolsVersion(): cppTools.Version {
        return this._cpptoolsVersion;
    }
    /**
     * Set the version of Cpptools API.
     * @param value of CppTools API version
     */
    set cpptoolsVersion(value: cppTools.Version) {
        this._cpptoolsVersion = value;
    }
}