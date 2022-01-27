import { Element as XmlElement } from '@oozcitak/dom/lib/dom/interfaces';
import { Uri } from 'vscode';
import { splitShellArgs } from '../../Tools/Helpers';
import { logger } from '../../Tools/Logger';
import { pathResolve, winPathToPosixPath } from '../../Tools/UriTools';
import { getChildElements } from '../../Tools/XmlDom';
import { AsPackageFile } from './AsPackageFile';

/** CPU and build configuration data */
export interface CpuConfiguration {
    /** Automation Runtime version used in the configuration */
    readonly arVersion?: string;
    /** Module ID of the CPU module */
    readonly cpuModuleId?: string;
    /** Configurations for build */
    readonly build: {
        /** Used gcc version */
        readonly gccVersion?: string;
        /** General additional build options */
        readonly additionalBuildOptions: string[];
        /** Additional build options for ANSI C programs */
        readonly ansiCAdditionalBuildOptions: string[];
        /** Additional build options for IEC programs */
        readonly iecAdditionalBuildOptions: string[];
        /** ANSI C include directories as paths in posix style (absolute or relative to AS project base) */
        readonly ansiCIncludeDirs: string[];
        /** Resolve `ansiCIncludeDirs` to get absolute URIs */
        readonly resolveAnsiCIncludeDirs: (projectRoot: Uri) => Uri[];
    }
}

/**
 * Cpu package file (Cpu.pkg in configuration directory). This package file contains additional
 * Cpu and build configuration data.
 */
export class CpuPackageFile extends AsPackageFile {

    /**
     * Creates an Automation Studio version from a specified root directory
     * @param filePath The root directory containing a single Automation Studio installation. e.g. `C:\BrAutomation\AS410`
     * @returns The version which was parsed from the root URI
     */
    public static async createFromPath(filePath: Uri): Promise<CpuPackageFile | undefined> {
        // Create and initialize object
        try {
            const xmlFile = new CpuPackageFile(filePath);
            await xmlFile._initialize();
            return xmlFile;
        } catch (error) {
            if (error instanceof Error) {
                logger.error(`Failed to read Cpu package file from path '${filePath.fsPath}': ${error.message}`);
            } else {
                logger.error(`Failed to read Cpu package file from path '${filePath.fsPath}'`);
            }
            logger.debug('Error details:', { error });
            return undefined;
        }
    }

    /** Object is not ready to use after constructor due to async operations,
     * #initialize() has to be called for the object to be ready to use! */
    protected constructor(filePath: Uri) {
        super(filePath);
        // other properties rely on async and will be initialized in #initialize()
    }

    /**
     * Async operations to finalize object construction
     * @throws If a required initialization process failed
     */
    protected async _initialize(): Promise<void> {
        await super._initialize();
        if (this.type !== 'Cpu') {
            throw new Error('Root element name is not <Cpu>');
        }
        this.#cpuConfig = getCpuConfiguration(this.rootElement);
        // init done
        this.#isInitialized = true;
        this.#logWarningsOnInitialized();
    }
    #isInitialized = false;

    /** CPU and build configuration data */
    public get cpuConfig() : CpuConfiguration {
        if (!this.#isInitialized || !this.#cpuConfig) { throw new Error(`Use of not initialized ${CpuPackageFile.name} object`); }
        return this.#cpuConfig;
    }
    #cpuConfig: CpuConfiguration | undefined;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        const obj = super.toJSON();
        obj.cpuConfig = this.cpuConfig;
        return obj;
    }

    /** Check object properties and write warnings to the logger if important properties are missing */
    #logWarningsOnInitialized() {
        // Collect missing properties
        const missingProperties: string[] = [];
        if (!this.cpuConfig.cpuModuleId) {
            missingProperties.push('CPU type');
        }
        if (!this.cpuConfig.arVersion) {
            missingProperties.push('AR version');
        }
        if (!this.cpuConfig.build.gccVersion) {
            missingProperties.push('gcc version');
        }
        // warn if there are missing properties
        if (missingProperties.length > 0) {
            const missingString = missingProperties.join(', ');
            logger.warning(`Cpu package file '${this.filePath.toString(true)} does not contain values: ${missingString}`);
        }
    }
}

/**
 * Get all child objects from the package XML
 * @throws If there are multiple child object root nodes (<Files> or <Objects>)
 */
function getCpuConfiguration(rootElement: XmlElement): CpuConfiguration {
    // Get properties from <Configuration> element
    const configElement = getChildElements(rootElement, 'Configuration').pop();
    if (!configElement) {
        throw new Error('No <Configuration> element found');
    }
    const cpuModuleId = configElement.getAttribute('ModuleId') ?? undefined;
    // Get properties from <AutomationRuntime> element
    const arElement = getChildElements(configElement, 'AutomationRuntime').pop();
    const arVersion = arElement?.getAttribute('Version') ?? undefined;
    // Get properties from <Build> element
    const buildElement = getChildElements(configElement, 'Build').pop();
    const gccVersion = buildElement?.getAttribute('GccVersion') ?? undefined;
    const buildOptionsRaw = buildElement?.getAttribute('AdditionalBuildOptions');
    const buildOptions = splitShellArgs(buildOptionsRaw);
    const ansiCBuildOptionsRaw = buildElement?.getAttribute('AnsicAdditionalBuildOptions');
    const ansiCBuildOptions = splitShellArgs(ansiCBuildOptionsRaw);
    const iecBuildOptionsRaw = buildElement?.getAttribute('IecAdditionalBuildOptions');
    const iecBuildOptions = splitShellArgs(iecBuildOptionsRaw);
    const ansiCIncludeDirsRaw = buildElement?.getAttribute('AnsicIncludeDirectories');
    const ansiCIncludeDirs = parseIncludeDirs(ansiCIncludeDirsRaw);
    // function to resolve include URIs from project root
    const resolveAnsiCIncludeDirs = (projectRoot: Uri) => {
        return ansiCIncludeDirs.map((path) => pathResolve(projectRoot, path));
    };
    // return info data
    return {
        arVersion: arVersion,
        cpuModuleId: cpuModuleId,
        build: {
            gccVersion: gccVersion,
            additionalBuildOptions: buildOptions,
            ansiCAdditionalBuildOptions: ansiCBuildOptions,
            iecAdditionalBuildOptions: iecBuildOptions,
            ansiCIncludeDirs: ansiCIncludeDirs,
            resolveAnsiCIncludeDirs: resolveAnsiCIncludeDirs,
        },
    };
}

/** Convert the raw value of the `AnsicIncludeDirectories` attribute to include paths */
function parseIncludeDirs(rawIncludes: string | undefined | null): string[] {
    // directly return for empty includes
    if ((!rawIncludes) || (rawIncludes.length === 0)) {
        return [];
    }
    // split multiple paths separated by ',' in file and change to posix style
    const asStylePaths = rawIncludes.split(',');
    return asStylePaths.map((path) => winPathToPosixPath(path));
}