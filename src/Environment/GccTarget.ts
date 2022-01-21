import * as vscode from 'vscode';
import * as uriTools from '../Tools/UriTools';
import * as semver from 'semver';
import { logger } from '../BrLog';
import { SystemGeneration, TargetArchitecture } from './CommonTypes';

/**
 * Representation of a gcc.exe for a specific target system type with additional information
 */
export class GccTarget {

    /**
     * Creates a gcc.exe representation for a specfic target system type by parsing the provided
     * data.
     * @param gccExe URI to the gcc.exe specific to this target system (e.g. '.../i386-elf-gcc.exe')
     * @param gccVersion Version of gcc of the exe (only required for `supportsQuery` hack)
     */
    constructor(gccExe: vscode.Uri, gccVersion: semver.SemVer) {
        this.#executable = gccExe;
        // get prefix to find system generation, architecture and includes
        const targetPrefix = uriTools.pathBasename(gccExe, '-gcc.exe');
        [this.#systemGeneration, this.#architecture] = targetSystemLookup(targetPrefix);
        if ((this.#systemGeneration === undefined) || (this.#architecture === undefined)) {
            logger.warning(`B&R system generation and architecture could not be evaluated for gcc in ${gccExe.fsPath}`);
        }
        const sysInclude = vscode.Uri.joinPath(gccExe, '../../', targetPrefix, './include');
        this.#systemIncludes = [sysInclude];
        // decide if gcc can be queried by the C/C++ extension
        //HACK This is based purely on trial and the expectation that all newer versions will support queries
        if (gccVersion.version === '2.95.3') {
            this.#supportsQuery = false;
        } else if (gccVersion.version === '4.1.1') {
            this.#supportsQuery = false;
        } else if ((gccVersion.version === '4.1.2') && (this.#architecture === 'IA32')) {
            this.#supportsQuery = false;
        } else {
            this.#supportsQuery = true;
        }
    }

    /** URI to the gcc.exe */
    public get executable(): vscode.Uri {
        return this.#executable;
    }
    #executable: vscode.Uri;

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

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            executable: this.executable.toString(true),
            systemGeneration: this.systemGeneration,
            architecture: this.architecture,
            systemIncludes: this.systemIncludes.map((uri) => uri.toString(true)),
            supportsQuery: this.supportsQuery,
        };
    }

    /** Sort value which can be used to get 'highest' target system */
    public get sortValue(): number {
        // System generation priority based on age -> newer is better
        const sgPriority: SystemGeneration[] = ['SGC', 'SG3', 'SG4', 'UNKNOWN'];
        const sgValue = sgPriority.indexOf(this.systemGeneration);
        // Architecture priority based on age and usage
        const archPriority: TargetArchitecture[] = ['M68K', 'Arm', 'IA32', 'UNKNOWN'];
        const archValue = archPriority.indexOf(this.architecture);
        // Total sort value gives higher priority to generation, as newer architectures support mostly the same functionality
        const value = (10 * sgValue) + archValue;
        return value;
    }
}

/** Lookup for target system generation and architecture from *-gcc.exe prefix */
function targetSystemLookup(gccPrefix: string): [SystemGeneration, TargetArchitecture] {
    // B&R gcc.exe are named according to the target system. For SG4 IA32 this is e.g. i386-elf-gcc.exe
    switch (gccPrefix) {
        case 'm68k-elf':
            return ['SG3', 'M68K'];

        case 'i386-elf':
        case 'i686-elf':
            return ['SG4', 'IA32'];

        case 'arm-elf':
        case 'arm-eabi':
            return ['SG4', 'Arm'];

        default:
            return ['UNKNOWN', 'UNKNOWN'];
    }
}