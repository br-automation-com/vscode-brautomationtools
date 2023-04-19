import { Uri } from "vscode";

export interface AsProjectCBuildInfo {
    readonly compilerPath: Uri | undefined;
    readonly systemIncludes: Uri[];
    readonly userIncludes: Uri[];
    readonly buildOptions: string[];
}

export function mergeAsProjectCBuildInfo(...values: (AsProjectCBuildInfo | undefined)[]): AsProjectCBuildInfo {
    // values to merge final result
    let compilerPath: Uri | undefined = undefined;
    const systemIncludes: Uri[] = [];
    const userIncludes: Uri[] = [];
    const buildOptions: string[] = [];
    // merge all values in loop
    for (const value of values) {
        if (value === undefined) {
            continue;
        }
        if (value.compilerPath !== undefined) {
            compilerPath = value.compilerPath;
        }
        systemIncludes.push(...value.systemIncludes);
        userIncludes.push(...value.userIncludes);
        buildOptions.push(...value.buildOptions);
    }
    // return merged data
    return {
        compilerPath: compilerPath,
        systemIncludes: systemIncludes,
        userIncludes: userIncludes,
        buildOptions: buildOptions,
    };
}
