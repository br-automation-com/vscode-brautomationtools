import * as vscode from "vscode";
import { Uri } from "vscode";
import { splitShellArgs } from "../../Tools/Helpers";
import { logger } from "../../Tools/Logger";
import { pathResolve, winPathToPosixPath } from "../../Tools/UriTools";
import { AsPackageFile } from "./AsPackageFile";
import { ParsedXmlObject } from "./AsXmlParser";

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
    };
}

/**
 * Cpu package file representation (Cpu.pkg in configuration directory). This package file contains additional
 * Cpu and build configuration data.
 */
export class CpuPackageFile extends AsPackageFile {
    /**
     * Creates a Cpu package file representation from a specified URI to the file
     * @param filePath The Cpu package file path. e.g. `C:\Projects\Test\Physical\TestConfig\TestPLC\Cpu.pkg`
     * @returns The Cpu package file representation which was parsed from the file
     */
    public static override async createFromFile(filePath: Uri): Promise<CpuPackageFile | undefined> {
        // Create and initialize object
        try {
            const textDoc = await vscode.workspace.openTextDocument(filePath);
            const fileContent = textDoc.getText();
            return new CpuPackageFile(filePath, fileContent);
        } catch (error) {
            logger.error(`Failed to read Cpu package file from path ${logger.formatUri(filePath)}. ${logger.formatError(error)}`);
            return undefined;
        }
    }

    /** TODO doc */
    protected constructor(filePath: Uri, fileContent: string) {
        super(filePath, fileContent);
        // other properties rely on async and will be initialized in #initialize()
        if (this.type !== "Cpu") {
            throw new Error("Root element name is not <Cpu>");
        }
        this.#cpuConfig = getCpuConfiguration(this.xmlRootObj);
        // init done
        this.#logWarningsForMissingProperties();
    }

    /** CPU and build configuration data */
    public get cpuConfig(): CpuConfiguration {
        return this.#cpuConfig;
    }
    #cpuConfig: CpuConfiguration;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public override toJSON(): Record<string, unknown> {
        const obj = super.toJSON();
        obj.cpuConfig = this.cpuConfig;
        return obj;
    }

    /** Check object properties and write warnings to the logger if important properties are missing */
    #logWarningsForMissingProperties(): void {
        // Collect missing properties
        const missingProperties: string[] = [];
        if (this.cpuConfig.cpuModuleId === undefined || this.cpuConfig.cpuModuleId.length === 0) {
            missingProperties.push("CPU type");
        }
        if (this.cpuConfig.arVersion === undefined || this.cpuConfig.arVersion.length === 0) {
            missingProperties.push("AR version");
        }
        if (this.cpuConfig.build.gccVersion === undefined || this.cpuConfig.build.gccVersion.length === 0) {
            missingProperties.push("gcc version");
        }
        // warn if there are missing properties
        if (missingProperties.length > 0) {
            const missingString = missingProperties.join(", ");
            logger.warning(`Cpu package file ${logger.formatUri(this.filePath)} does not contain the values: ${missingString}`);
        }
    }
}

/**
 * Get all child objects from the package XML
 * @throws If there are multiple child object root nodes (<Files> or <Objects>)
 */
function getCpuConfiguration(rootElement: ParsedXmlObject): CpuConfiguration {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const rootAny = rootElement as any;
    // Get properties from <Configuration> element
    const configElement = rootAny.Configuration;
    if (typeof configElement !== "object" || configElement === null) {
        throw new Error("No <Configuration> element found");
    }
    const cpuModuleId = configElement?._att?.ModuleId as unknown;
    // Get properties from <AutomationRuntime> element
    const arVersion = configElement?.AutomationRuntime?._att?.Version as unknown;
    // Get properties from <Build> element
    const gccVersion = configElement?.Build?._att?.GccVersion as unknown;
    const buildOptionsRaw = configElement?.Build?._att?.AdditionalBuildOptions as unknown;
    const buildOptions = typeof buildOptionsRaw === "string" ? splitShellArgs(buildOptionsRaw) : [];
    const ansiCBuildOptionsRaw = configElement?.Build?._att?.AnsicAdditionalBuildOptions as unknown;
    const ansiCBuildOptions = typeof ansiCBuildOptionsRaw === "string" ? splitShellArgs(ansiCBuildOptionsRaw) : [];
    const iecBuildOptionsRaw = configElement?.Build?._att?.IecAdditionalBuildOptions as unknown;
    const iecBuildOptions = typeof iecBuildOptionsRaw === "string" ? splitShellArgs(iecBuildOptionsRaw) : [];
    const ansiCIncludeDirsRaw = configElement?.Build?._att?.AnsicIncludeDirectories as unknown;
    const ansiCIncludeDirs = typeof ansiCIncludeDirsRaw === "string" ? parseIncludeDirs(ansiCIncludeDirsRaw) : [];
    /* eslint-enable */
    // function to resolve include URIs from project root
    const resolveAnsiCIncludeDirs = (projectRoot: Uri): Uri[] => {
        return ansiCIncludeDirs.map((path) => pathResolve(projectRoot, path));
    };
    // return info data
    return {
        arVersion: typeof arVersion === "string" ? arVersion : undefined,
        cpuModuleId: typeof cpuModuleId === "string" ? cpuModuleId : undefined,
        build: {
            gccVersion: typeof gccVersion === "string" ? gccVersion : undefined,
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
    if (!rawIncludes || rawIncludes.length === 0) {
        return [];
    }
    // split multiple paths separated by ',' in file and change to posix style
    const asStylePaths = rawIncludes.split(",");
    return asStylePaths.map((path) => winPathToPosixPath(path));
}
