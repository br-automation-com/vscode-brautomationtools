/**
 * Various helper functions
 * @packageDocumentation
 */

import * as vscode from 'vscode';


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
