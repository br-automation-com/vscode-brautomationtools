/**
 * Various helper functions
 * @packageDocumentation
 */

import { isString } from './TypeGuards';

/**
 * Pushes items to an array, only if the item is not null or undefined
 * @param array Array to which item is pushed
 * @param item Item which is checked and pushed
 */
export function pushDefined<T>(array: T[], ...items: (T | undefined | null)[]) {
    for (const item of items) {
        if ( (item !== undefined) && (item !== null) ) {
            array.push(item!);
        }
    }
}

/**
 * Creates a delay, which can be awaited.
 * @param ms Delay time in milliseconds
 */
export function delay(ms: number) {
    return new Promise( (resolve) => setTimeout(resolve, ms) );
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
    const fff = `${millis}`.padStart(3, '0');
    const ss = `${seconds}`.padStart(2, '0');
    const mm = `${minutes}`.padStart(2, '0');
    const hh = `${hours}`.padStart(2, '0');
    return `${hh}:${mm}:${ss}.${fff}`;
}

export function testStringFilter(value: string, filter: string | RegExp | undefined): boolean {
    if (filter === undefined) {
        return true;
    } else if (isString(filter)) {
        return (filter === value);
    } else { // is RegExp
        filter.lastIndex = 0; // reset index in case /g flag was set, see #32
        return filter.test(value);
    }
}

/**
 * Converts a string value to a boolean or undefined value. Value is not cases sensitive 'true' == 'TRUE' == 'True' == 'TrUe'
 * @param value Value which should be converted
 * @returns `true` for 'true' and '1', `false` for 'false' and '0', undefined for all other input
 */
export function stringToBoolOrUndefined(value: string | undefined | null): boolean | undefined {
    if (!value) {
        return undefined;
    }
    const valueLower = value.toLowerCase();
    if (valueLower === 'true') {
        return true;
    } else if (valueLower === 'false') {
        return false;
    } else {
        return undefined;
    }
}

/**
 * Converts a string value to a boolean. Value is not cases sensitive 'true' == 'TRUE' == 'True' == 'TrUe'
 * @param value Value which should be converted
 * @returns `true` for 'true' and '1', undefined for all other input
 */
export function stringToBool(value: string | undefined | null): boolean {
    return stringToBoolOrUndefined(value) ?? false;
}