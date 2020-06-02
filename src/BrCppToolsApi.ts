import * as vscode from 'vscode';
import * as cppTools from 'vscode-cpptools';
import * as path from 'path';
import * as BRAsProjectWorkspace from './BRAsProjectWorkspace';
import * as Helpers from './Helpers';


/* TODO currently standard includes and defines are provided from here, maybe it is possible
to use the proper compiler path... definitions so the C++ Extension automatically parses
includes, defines... from the compiler command. In the tests it did not work so far, maybe
related to https://github.com/microsoft/vscode-cpptools/issues/5512
*/

/**
 * Register the custom configuration provider on the C/C++ Tools extension
 */
export async function registerCppToolsConfigurationProvider(): Promise<void> {
    const provider = new CppConfigurationProvider();
    const cppToolsApi = await cppTools.getCppToolsApi(cppTools.Version.v3);
    cppToolsApi?.registerCustomConfigurationProvider(provider);
    cppToolsApi?.notifyReady(provider);
}


/**
 * The actual class that provides information to the cpptools extension. See
 * the `CustomConfigurationProvider` interface for information on how this class
 * should be used.
 */
export class CppConfigurationProvider implements cppTools.CustomConfigurationProvider {
    //TODO currently only basic implementation, maybe check how CMake did it to get a more professional solution

    //#region cppTools.CustomConfigurationProvider interface implementation
    /* Our name and extension ID visible to cpptools */
    readonly name = 'B&R Automation Tools';
    readonly extensionId = 'vscode-brautomationtools';

    async canProvideConfiguration(uri: vscode.Uri): Promise<boolean> {
        Helpers.logTimedHeader('canProvideConfiguration');
        console.log(uri.toString(true));
        //TODO
        return true;
    }

    async provideConfigurations(uris: vscode.Uri[], token?: vscode.CancellationToken): Promise<cppTools.SourceFileConfigurationItem[]> {
        Helpers.logTimedHeader('provideConfigurations');
        for (const uri of uris) {
            console.log(uri.toString());
        }
        let configurations: cppTools.SourceFileConfigurationItem[] = [];
        for (const uri of uris) {
            const config = await this._getConfiguration(uri);
            if (config !== undefined) {
                configurations.push(config);
            }
        }
        return configurations;
    }

    async canProvideBrowseConfiguration(): Promise<boolean> {
        Helpers.logTimedHeader('canProvideBrowseConfiguration');
        //TODO
        return false;
    }

    async provideBrowseConfiguration(): Promise<cppTools.WorkspaceBrowseConfiguration> {
        Helpers.logTimedHeader('provideBrowseConfiguration');
        //TODO
        return this._workspaceBrowseConfiguration;
    }

    async canProvideBrowseConfigurationsPerFolder(): Promise<boolean> {
        Helpers.logTimedHeader('canProvideBrowseConfigurationsPerFolder');
        //TODO
        return false;
    }

    async provideFolderBrowseConfiguration(_uri: vscode.Uri): Promise<cppTools.WorkspaceBrowseConfiguration> {
        Helpers.logTimedHeader('provideFolderBrowseConfiguration');
        return this.provideBrowseConfiguration();
        //return this._workspaceBrowseConfigurations.get(util.platformNormalizePath(_uri.fsPath)) ?? this._workspaceBrowseConfiguration;
    }
    //#endregion cppTools.CustomConfigurationProvider interface implementation

    //#region fields
    private _workspaceBrowseConfiguration: cppTools.WorkspaceBrowseConfiguration = { browsePath: [] };
    private readonly _workspaceBrowseConfigurations = new Map<string, cppTools.WorkspaceBrowseConfiguration>();

    //TODO get standard values depending on AS version, selected target, gcc version...
    /** Standard header file locations */
    private readonly standardIncludePaths = [
        'C:\\BrAutomation\\AS46\\AS\\gnuinst\\V4.1.2\\i386-elf\\include\\',
        'C:\\BrAutomation\\AS46\\AS\\gnuinst\\V4.1.2\\lib\\gcc\\i386-elf\\4.1.2\\include\\'
    ];

    /** Standard compiler arguments */
    private readonly defaultCompilerArgs = [
        '-fPIC',
        '-O0',
        '-g',
        '-Wall',
        '-ansi',
        '-D',
        '_DEFAULT_INCLUDES',
        '-D',
        '_SG4'
    ];

    private readonly defaultDefines = [
        '_DEFAULT_INCLUDES'
    ];

    private readonly defaultIntelliSenseMode = 'gcc-x86';

    private readonly defaultCStandard = 'gnu99';

    private readonly defaultCompilerPath = 'C:\\BrAutomation\\AS46\\AS\\gnuinst\\V4.1.2\\i386-elf\\bin\\gcc.exe';
    //#endregion fields

    /**
     * Get the SourceFileConfigurationItem for the given URI
     * @param uri The uri to get the configuration from
     */
    private async _getConfiguration(uri: vscode.Uri): Promise<cppTools.SourceFileConfigurationItem | undefined> {
        Helpers.logTimedHeader('_getConfiguration');
        console.log(uri.toString(true));
        // get headers
        const headerUris = await this._getHeaderUris(uri);
        const headerPaths = headerUris.map(u => u.fsPath);
        headerPaths.push(...this.standardIncludePaths);
        //TODO get other settings properly
        const config: cppTools.SourceFileConfigurationItem = {
            uri: uri,
            configuration: {
                includePath: headerPaths,
                defines: this.defaultDefines,
                intelliSenseMode: this.defaultIntelliSenseMode,
                standard: this.defaultCStandard,
                compilerArgs: this.defaultCompilerArgs,
                compilerPath: this.defaultCompilerPath,
            }
        };
        console.log(config);
        return config;
    }

    /**
     * Get all header include URIs to a specific source file
     * @param uri URI of the source file of which the headers are requested
     */
    private async _getHeaderUris(uri: vscode.Uri): Promise<vscode.Uri[]> {
        // get workspace base paths
        const workspaceUris = await BRAsProjectWorkspace.getProjectBaseUris();
        if (workspaceUris === undefined) {
            return [];
        }
        let logicalBasePath = workspaceUris.logical.fsPath;
        let includeBasePath = workspaceUris.temporaryIncludes.fsPath;
        if (logicalBasePath === undefined) {
            return [];
        }
        // TODO test for libraries and maybe also headers in includes dir?
        const headerUris: vscode.Uri[] = [];
        let finished = false;
        let currentPath = path.parse(uri.fsPath);
        while (!finished) {
            let currentDir = currentPath.dir;
            let relativeToLogical = path.relative(logicalBasePath, currentDir);
            let includePath = path.join(includeBasePath, relativeToLogical);
            let includeUri = vscode.Uri.file(includePath);
            headerUris.push(includeUri);
            // check logical path reached or reached base
            if (currentDir === logicalBasePath) {
                finished = true;
            }
            if (currentDir === '') {
                // error, never reached logicalBasePath --> file is not in AS project
                return [];
            }
            // next higher folder
            currentPath = path.parse(currentPath.dir);
        }
        //TODO

        return headerUris;
    }

    /** No-op */
    dispose() { }

    /**
     * Version of Cpptools API
     */
    private _cpptoolsVersion: cppTools.Version = cppTools.Version.latest;

    /**
     * Index of files to configurations, using the normalized path to the file
     * as the key to the <target,configuration>.
     */
    private readonly _fileIndex = new Map<string, Map<string, cppTools.SourceFileConfigurationItem>>();

    /**
     * If a source file configuration exists for the active target, we will prefer that one when asked.
     */
    private _activeTarget: string | null = null;

    /**
     * Create a source file configuration for the given file group.
     * @param fileGroup The file group from the code model to create config data for
     * @param opts Index update options
     */
    private _buildConfigurationData(/*fileGroup: codemodel_api.CodeModelFileGroup, opts: CodeModelParams, target: TargetDefaults, sysroot: string*/):
        cppTools.SourceFileConfiguration {
        /*
        // If the file didn't have a language, default to C++
        const lang = fileGroup.language;
        // Try the group's language's compiler, then the C++ compiler, then the C compiler.
        const comp_cache = opts.cache.get(`CMAKE_${lang}_COMPILER`) || opts.cache.get('CMAKE_CXX_COMPILER')
            || opts.cache.get('CMAKE_C_COMPILER');
        // Try to get the path to the compiler we want to use
        const comp_path = comp_cache ? comp_cache.as<string>() : opts.clCompilerPath;
        if (!comp_path) {
            throw new MissingCompilerException();
        }
        const normalizedCompilerPath = util.platformNormalizePath(comp_path);
        const flags = fileGroup.compileFlags ? [...shlex.split(fileGroup.compileFlags)] : target.compileFlags;
        const { standard, extraDefinitions, targetArch } = parseCompileFlags(this.cpptoolsVersion, flags, lang);
        const defines = (fileGroup.defines || target.defines).concat(extraDefinitions);
        const includePath = fileGroup.includePath ? fileGroup.includePath.map(p => p.path) : target.includePath;
        const normalizedIncludePath = includePath.map(p => util.platformNormalizePath(p));
 
        const newBrowsePath = this._workspaceBrowseConfiguration.browsePath;
        for (const includePathItem of normalizedIncludePath) {
            if (newBrowsePath.indexOf(includePathItem) < 0) {
                newBrowsePath.push(includePathItem);
            }
        }
 
        if (sysroot) {
            flags.push(`--sysroot=${sysroot}`);
        }
 
        this._workspaceBrowseConfiguration = {
            browsePath: newBrowsePath,
            standard,
            compilerPath: normalizedCompilerPath || undefined,
            compilerArgs: flags || undefined
        };
 
        this._workspaceBrowseConfigurations.set(util.platformNormalizePath(opts.folder), this._workspaceBrowseConfiguration);
        return {
            defines,
            standard,
            includePath: normalizedIncludePath,
            intelliSenseMode: getIntelliSenseMode(this.cpptoolsVersion, comp_path, targetArch),
            compilerPath: normalizedCompilerPath || undefined,
            compilerArgs: flags || undefined
        };
        */
        let a: cppTools.SourceFileConfiguration = {
            includePath: ['TODO'],
            defines: ['TODO'],
            intelliSenseMode: 'gcc-x86',
            standard: 'c11'
        };
        return a;
    }

    /**
     * Update the configuration index for the files in the given file group
     * @param sourceDir The source directory where the file group was defined. Used to resolve
     * relative paths
     * @param grp The file group
     * @param opts Index update options
     */
    private _updateFileGroup(/*sourceDir: string,
        grp: codemodel_api.CodeModelFileGroup,
        opts: CodeModelParams,
        target: TargetDefaults,
        sysroot: string*/) {
        /*
        const configuration = this._buildConfigurationData(grp, opts, target, sysroot);
        for (const src of grp.sources) {
            const abs = path.isAbsolute(src) ? src : path.join(sourceDir, src);
            const abs_norm = util.platformNormalizePath(abs);
            if (this._fileIndex.has(abs_norm)) {
                this._fileIndex.get(abs_norm)!.set(target.name, {
                    uri: vscode.Uri.file(abs).toString(),
                    configuration
                });
            } else {
                const data = new Map<string, cppTools.SourceFileConfigurationItem>();
                data.set(target.name, {
                    uri: vscode.Uri.file(abs).toString(),
                    configuration,
                });
                this._fileIndex.set(abs_norm, data);
            }
            const dir = path.dirname(abs_norm);
            if (this._workspaceBrowseConfiguration.browsePath.indexOf(dir) < 0) {
                this._workspaceBrowseConfiguration.browsePath.push(dir);
            }
        }
        */
    }

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

    /**
     * Update the file index and code model
     * @param opts Update parameters
     */
    updateConfigurationData(/*opts: CodeModelParams*/) {
        /*
        let hadMissingCompilers = false;
        this._workspaceBrowseConfiguration = { browsePath: [] };
        this._activeTarget = opts.activeTarget;
        for (const config of opts.codeModel.configurations) {
            for (const project of config.projects) {
                for (const target of project.targets) {
                    /// Now some shenanigans since header files don't have config data:
                    /// 1. Accumulate some "defaults" based on the set of all options for each file group
                    /// 2. Pass these "defaults" down when rebuilding the config data
                    /// 3. Any `fileGroup` that does not have the associated attribute will receive the `default`
                    const grps = target.fileGroups || [];
                    const includePath = [...new Set(util.flatMap(grps, grp => grp.includePath || []))].map(item => item.path);
                    const compileFlags = [...new Set(util.flatMap(grps, grp => shlex.split(grp.compileFlags || '')))];
                    const defines = [...new Set(util.flatMap(grps, grp => grp.defines || []))];
                    const sysroot = target.sysroot || '';
                    for (const grp of target.fileGroups || []) {
                        try {
                            this._updateFileGroup(
                                target.sourceDirectory || '',
                                grp,
                                opts,
                                {
                                    name: target.name,
                                    compileFlags,
                                    includePath,
                                    defines,
                                },
                                sysroot
                            );
                        } catch (e) {
                            if (e instanceof MissingCompilerException) {
                                hadMissingCompilers = true;
                            } else {
                                throw e;
                            }
                        }
                    }
                }
            }
        }
        if (hadMissingCompilers && this._lastUpdateSucceeded) {
            vscode.window.showErrorMessage(localize('path.not.found.in.cmake.cache',
                'The path to the compiler for one or more source files was not found in the CMake cache. If you are using a toolchain file, this probably means that you need to specify the CACHE option when you set your C and/or C++ compiler path'));
        }
        this._lastUpdateSucceeded = !hadMissingCompilers;
        */
    }
}