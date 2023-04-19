/**
 * Interface to the [ms-vscode.cpptools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) extension.
 * @packageDocumentation
 */

import * as vscode from 'vscode';
import * as cppTools from 'vscode-cpptools';
import { logger } from '../Tools/Logger';
import * as Helpers from '../Tools/Helpers';
import * as uriTools from '../Tools/UriTools';
import { Environment } from '../Environment/Environment';
import { WorkspaceProjects } from '../Workspace/BRAsProjectWorkspace';

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
export function didChangeCppToolsConfig(): void {
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
        void Environment.automationStudio.getVersions().then(() => this.didChangeCppToolsConfig()); // TODO clarify async in #55
        void WorkspaceProjects.getProjects().then(() => this.didChangeCppToolsConfig()); // TODO clarify async in #55
        this.#cppApi.notifyReady(this);
        return true;
    }

    didChangeCppToolsConfig(): void {
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
        const asProject = await WorkspaceProjects.getProjectForUri(uri);
        let canProvide = false;
        if (asProject !== undefined) {
            const isInLogical = uriTools.isSubOf(asProject.paths.logical, uri);
            const isInPhysical = uriTools.isSubOf(asProject.paths.physical, uri);
            const isInTemp = uriTools.isSubOf(asProject.paths.temp, uri);
            canProvide = isInLogical || isInPhysical || isInTemp;
        }
        logger.debug('CppConfigurationProvider.canProvideConfiguration(uri)', { uri: uri.toString(true), return: canProvide });
        return canProvide;
    }

    async provideConfigurations(uris: vscode.Uri[], token?: vscode.CancellationToken): Promise<cppTools.SourceFileConfigurationItem[]> {
        const configs = await Promise.all(uris.map((uri) => this._getConfiguration(uri)));
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
    async canProvideBrowseConfiguration(): Promise<boolean> { return Promise.resolve(false); }
    async provideBrowseConfiguration(): Promise<cppTools.WorkspaceBrowseConfiguration> { return Promise.resolve({ browsePath: [] }); }
    async canProvideBrowseConfigurationsPerFolder(): Promise<boolean> { return Promise.resolve(false); }
    async provideFolderBrowseConfiguration(_uri: vscode.Uri): Promise<cppTools.WorkspaceBrowseConfiguration> { return Promise.resolve({ browsePath: [] }); }

    //#endregion cppTools.CustomConfigurationProvider interface implementation

    /**
     * Get the SourceFileConfigurationItem for the given URI
     * @param uri The uri to get the configuration from
     */
    private async _getConfiguration(uri: vscode.Uri): Promise<cppTools.SourceFileConfigurationItem | undefined> {
        // get build info from AS project API
        const buildInfo = await WorkspaceProjects.getCBuildInformationForUri(uri);
        if (buildInfo === undefined) {
            return undefined;
        }
        // create and return C/C++ configuration
        const headerUris: vscode.Uri[] = [...buildInfo.systemIncludes, ...buildInfo.userIncludes];
        const headerPaths = headerUris.map((u) => u.fsPath);
        const config: cppTools.SourceFileConfigurationItem = {
            uri: uri,
            configuration: {
                includePath: headerPaths,
                defines: [],
                intelliSenseMode: undefined,
                standard: undefined,
                compilerArgs: buildInfo.buildOptions,
                compilerPath: buildInfo.compilerPath?.fsPath,
            }
        };
        return config;
    }

    /** Dispose all disposable resources */
    dispose(): void {
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