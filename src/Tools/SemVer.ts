import { coerce, compare, satisfies, SemVer } from 'semver';
import { logger } from '../BrLog';


export interface HasVersion {
    version: SemVer
}

/**
 * Get a specific version object. If used in non strict mode, the highest available version will be returned.
 * @param versionRequest The requested version which should be prefered. Can be set to `undefined` if any version is ok
 * @param strict Only return object with same major.minor version. Defaults to `false`
 * @returns An object which fullfills the request or `undefined` if no such version was found
 */
export function requestVersion<T extends HasVersion>(source: T[], requested?: SemVer | string, strict = false): T | undefined {
    // direct return if no versions available
    if (source.length <= 0) {
        return undefined;
    }
    // newest if no version defined
    if (requested === undefined) {
        return highestVersion(source);
    }
    // find match if version defined
    const requestAsSemVer = coerce(requested);
    if (!requestAsSemVer) {
        logger.debug('requestVersion(source, requested, strict) -> requested is no valid SemVer', { requested: requested, strict: strict });
        return undefined;
    }
    const matchMajorMinor = `${requestAsSemVer.major}.${requestAsSemVer.minor}.x`;
    const match = source.find((v) => satisfies(v.version, matchMajorMinor));
    // return depending on match found or strict mode set
    if (match !== undefined) {
        return match;
    } else if (!strict) {
        return highestVersion(source);
    } else {
        return undefined;
    }
}

/**
 * Get the object of a collection with the highest version
 * @returns The object with the highest version in the collection, or `undefined` if the collection is empty
 */
export function highestVersion<T extends HasVersion>(source: T[]): T | undefined {
    // direct return if no versions available
    if (source.length <= 0) {
        return undefined;
    }
    // find highest
    let highest = source[0];
    for (const act of source) {
        if (compare(act.version, highest.version) > 0) {
            highest = act;
        }
    }
    return highest;
}