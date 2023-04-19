import * as vscode from "vscode";
import * as uriTools from "../Tools/UriTools";
import * as semver from "semver";
import { logger } from "../Tools/Logger";
import { SystemGeneration, TargetArchitecture } from "./CommonTypes";
import { spawnSync } from "child_process";
import { AsProjectCBuildInfo } from "./AsProjectCBuildData";

/**
 * Representation of a gcc.exe with additional information
 */
export class GccExecutable {
    /**
     * Compare two gcc executables for match query, to give best result in non strict mode
     * @returns `0` if a == b; `1` if a is greater; `-1` if b is greater
     */
    public static compareForQuery(a: GccExecutable, b: GccExecutable): number {
        // compare with priority of comparison, version > system generation > architecture
        // version
        const versionCompare = semver.compare(a.version, b.version);
        if (versionCompare !== 0) {
            return versionCompare;
        }
        // system generation
        const sgPriority: SystemGeneration[] = ["SGC", "SG3", "SG4", "UNKNOWN"];
        const sgValueA = sgPriority.indexOf(a.systemGeneration);
        const sgValueB = sgPriority.indexOf(b.systemGeneration);
        const sgCompare = sgValueA - sgValueB;
        if (sgCompare !== 0) {
            return sgCompare < 0 ? -1 : 1;
        }
        // Architecture priority based on age and usage
        const archPriority: TargetArchitecture[] = ["M68K", "Arm", "IA32", "UNKNOWN"];
        const archValueA = archPriority.indexOf(a.architecture);
        const archValueB = archPriority.indexOf(b.architecture);
        const archCompare = archValueA - archValueB;
        if (archCompare !== 0) {
            return archCompare < 0 ? -1 : 1;
        }
        return 0;
    }

    /**
     * Creates a gcc.exe representation for a specfic target system type by parsing the provided
     * data.
     * @param exePath URI to the gcc.exe specific to this target system (e.g. '.../i386-elf-gcc.exe')
     * @param gccVersion Version of gcc of the exe to prevent querying the gcc.exe. Can be set if version is known for better performance (~50-100ms per call)
     */
    public constructor(exePath: vscode.Uri, gccVersion?: semver.SemVer) {
        this.#exePath = exePath;
        // assign version from contructor arg, query to gcc or V0.0.0
        let usedVersion = gccVersion;
        if (!usedVersion) {
            usedVersion = queryGccVersion(exePath);
        }
        if (!usedVersion) {
            logger.warning(`gcc version for ${logger.formatUri(exePath)} could not be evaluated. Gcc will be listed as V0.0.0`);
            usedVersion = new semver.SemVer("0.0.0");
        }
        this.#version = usedVersion;
        // Get target machine from gcc.exe prefix or query to gcc
        const exeName = uriTools.pathBasename(exePath);
        const machinePrefixIdx = exeName.lastIndexOf("-gcc.exe");
        let targetMachine = exeName.substring(0, machinePrefixIdx);
        if (targetMachine.length === 0) {
            targetMachine = queryGccMachine(exePath) ?? ""; // query only when no prefix, because query is slower
        }
        this.#targetMachine = targetMachine;
        // use target machine to set system generation, architecture and include dir
        [this.#systemGeneration, this.#architecture] = targetSystemLookup(this.#targetMachine);
        if (this.#systemGeneration === "UNKNOWN" || this.#architecture === "UNKNOWN") {
            logger.warning(`B&R system generation and architecture could not be evaluated for gcc in ${logger.formatUri(exePath)}.`);
        }
        const sysInclude = vscode.Uri.joinPath(exePath, "../../", this.#targetMachine, "./include");
        this.#systemIncludes = [sysInclude];
        // decide if gcc can be queried by the C/C++ extension
        //HACK This is based purely on trial and the expectation that all newer versions will support queries
        if (this.#version.major < 4) {
            this.#supportsQuery = false;
        } else if (this.#version.major === 4 && this.#architecture === "IA32") {
            this.#supportsQuery = false;
        } else {
            this.#supportsQuery = true;
        }
    }

    /** URI to the gcc.exe */
    public get exePath(): vscode.Uri {
        return this.#exePath;
    }
    #exePath: vscode.Uri;

    /** gcc version */
    public get version(): semver.SemVer {
        return this.#version;
    }
    #version: semver.SemVer;

    /** target machine string */
    public get targetMachine(): string {
        return this.#targetMachine;
    }
    #targetMachine: string;

    /** The B&R system generation targeted by this gcc executable */
    public get systemGeneration(): SystemGeneration {
        return this.#systemGeneration;
    }
    #systemGeneration: SystemGeneration;

    /** The CPU architecture targeted by this gcc executable */
    public get architecture(): TargetArchitecture {
        return this.#architecture;
    }
    #architecture: TargetArchitecture;

    /** System include directories. Use only if `supportsQuery` is `false` */
    public get systemIncludes(): vscode.Uri[] {
        return this.#systemIncludes;
    }
    #systemIncludes: vscode.Uri[];

    /** Compiler supports to be queried for includes... by the C/C++ extension
     * If queries are supported, the `systemIncludes` should be ignored, as the query is
     * a more reliable source.
     */
    public get supportsQuery(): boolean {
        return this.#supportsQuery;
    }
    #supportsQuery: boolean;

    /** C-Build info as a structure */
    public get cBuildInfo(): AsProjectCBuildInfo {
        return {
            compilerPath: this.exePath,
            systemIncludes: this.supportsQuery ? [] : this.systemIncludes,
            userIncludes: [],
            buildOptions: [],
        };
    }

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): Record<string, unknown> {
        return {
            exePath: this.exePath.toString(true),
            version: this.version.version,
            targetMachine: this.targetMachine,
            systemGeneration: this.systemGeneration,
            architecture: this.architecture,
            systemIncludes: this.systemIncludes.map((uri) => uri.toString(true)),
            supportsQuery: this.supportsQuery,
        };
    }
}

/** Lookup for target system generation and architecture from *-gcc.exe prefix */
function targetSystemLookup(gccPrefix: string): [SystemGeneration, TargetArchitecture] {
    // B&R gcc.exe are named according to the target system. For SG4 IA32 this is e.g. i386-elf-gcc.exe
    switch (gccPrefix) {
        case "m68k-elf":
            return ["SG3", "M68K"];

        case "i386-elf":
        case "i686-elf":
            return ["SG4", "IA32"];

        case "arm-elf":
        case "arm-eabi":
            return ["SG4", "Arm"];

        default:
            return ["UNKNOWN", "UNKNOWN"];
    }
}

/** Calls `gcc.exe -dumpversion` to get the gcc version */
function queryGccVersion(gccExe: vscode.Uri): semver.SemVer | undefined {
    const callResult = spawnSync(gccExe.fsPath, ["-dumpversion"]);
    if (!callResult.error) {
        const stdout = callResult.stdout.toString().trim();
        return semver.coerce(stdout) ?? undefined;
    } else {
        return undefined;
    }
}

/** Calls `gcc.exe -dumpmachine` to get the gcc target machine */
function queryGccMachine(gccExe: vscode.Uri): string | undefined {
    const callResult = spawnSync(gccExe.fsPath, ["-dumpmachine"]);
    if (!callResult.error) {
        const stdout = callResult.stdout.toString().trim();
        return stdout;
    } else {
        return undefined;
    }
}
