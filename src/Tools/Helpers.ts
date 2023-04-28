/**
 * Various helper functions
 * @packageDocumentation
 */

import { isString } from "./TypeGuards";

/**
 * Pushes items to an array, only if the item is not null or undefined
 * @param array Array to which item is pushed
 * @param item Item which is checked and pushed
 */
export function pushDefined<T>(array: T[], ...items: (T | undefined | null)[]): void {
    for (const item of items) {
        if (item !== undefined && item !== null) {
            array.push(item);
        }
    }
}

/**
 * Creates a delay, which can be awaited.
 * @param ms Delay time in milliseconds
 */
export async function delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a string representing the difference between two times with format `hh:mm:ss.fff`
 * @param start Start time
 * @param end End time
 */
export function timeDiffString(start: Date, end: Date): string {
    let remain = end.getTime() - start.getTime();
    // millis
    const millis = remain % 1000;
    remain = Math.floor(remain / 1000);
    // seconds
    const seconds = remain % 60;
    remain = Math.floor(remain / 60);
    // minutes
    const minutes = remain % 60;
    remain = Math.floor(remain / 60);
    // hours
    const hours = Math.floor(remain / 60);
    // string
    const fff = `${millis}`.padStart(3, "0");
    const ss = `${seconds}`.padStart(2, "0");
    const mm = `${minutes}`.padStart(2, "0");
    const hh = `${hours}`.padStart(2, "0");
    return `${hh}:${mm}:${ss}.${fff}`;
}

/**
 * Checks if a sting fullfills a specified filter.
 * @param value string value to check
 * @param filter filter value, if a RegExp with /g flag is used, it is automatically reset before testing
 * @returns
 *
 * `value` === filter if filter is `string`
 *
 * `filter.test(value)` if filter is `RegExp`
 *
 * `true` if filter is `undefined` (all pass)
 */
export function testStringFilter(value: string, filter: string | RegExp | undefined): boolean {
    if (filter === undefined) {
        return true;
    } else if (isString(filter)) {
        return filter === value;
    } else {
        // is RegExp
        filter.lastIndex = 0; // reset index in case /g flag was set, see #32
        return filter.test(value);
    }
}

/**
 * Converts a value to a boolean or undefined.
 * Converts a string value to a boolean or undefined value. Value is not cases sensitive 'true' == 'TRUE' == 'True' == 'TrUe'
 * @param value Value which should be converted
 * @returns `true` for `'true'` `true` `'1'` and `1`, `false` for `'false'` `false` `'0'` and `0`, undefined for all other input
 */
export function anyToBoolOrUndefined(value: unknown): boolean | undefined {
    const valueToLower = typeof value === "string" ? value.toLowerCase() : undefined;
    if (valueToLower === "true" || value === true || value === "1" || value === 1) {
        return true;
    } else if (valueToLower === "false" || value === false || value === "0" || value === 0) {
        return true;
    } else {
        return undefined;
    }
}

/**
 * Converts a string value to a boolean. Value is not cases sensitive 'true' == 'TRUE' == 'True' == 'TrUe'
 * @param value Value which should be converted
 * @returns `true` for 'true' and '1', false for all other input
 */
export function stringToBool(value: string | undefined | null): boolean {
    return anyToBoolOrUndefined(value) ?? false;
}

/**
 * Split a raw string of shell arguments into an array of its separate commands / parameters.
 * This can be used to prevent automatic escaping of strings, containing white spaces by some
 * functions.
 *
 * Already escaped parts of the string (e.g. `'-include "C:\My Path\SomeHeader.h"'`) will be split on each whitespace
 * and therefore break in the current implementation!
 *
 * @param rawArgs Raw command line arguments contained in a single string. e.g. `'-D MY_DEFINE -D OTHER_DEFINE -Wall'`
 * @returns An array with all the build options separated on each whitespace. e.g. `['-D', 'MY_DEFINE', '-D', 'OTHER_DEFINE', '-Wall']`
 *
 * If input is `undefined`, `null` or an empty string, an empty array is returned
 */
export function splitShellArgs(rawArgs: string | undefined | null): string[] {
    // #30 - When splitting will handle escapes properly use a new function argument `escapeChar?: string | string[] | RegExp`
    // directly return for empty options
    if (rawArgs === undefined || rawArgs === null || rawArgs.length === 0) {
        return [];
    }
    const options = rawArgs.split(/\s/gm);
    return options;
}

/**
 * Creates a new object where all undefined properties from a source object were filtered out
 * @param source The source object or array which contains undefined values
 * @returns A new object where all properties and array elements with value `undefinef` were removed
 */
export function withoutUndefined(source: unknown): unknown {
    if (typeof source !== "object") return source;
    if (source === null) return source;
    if (Array.isArray(source)) {
        return source.filter((ele) => ele !== undefined).map((ele) => withoutUndefined(ele));
    }
    return Object.fromEntries(
        Object.entries(source)
            .filter(([_, value]) => value !== undefined)
            .map(([key, oldVal]) => [key, withoutUndefined(oldVal)])
    );
}
