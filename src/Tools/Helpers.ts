/**
 * Various helper functions
 * @packageDocumentation
 */

import * as vscode from 'vscode';


/**
 * Writes a well visible header with a timestamp to the console. Can be useful for testing.
 * The total string will be filled up with `*` to fit the lineLength
 * @example logTimedHeader('Hello', 25) --> '22:42:13 - Hello ********'
 * @param message The message to write
 * @param lineLength The line length for filling up with `*`
 */
export function logTimedHeader(message: string, lineLength: number = 150): void {
    const time = new Date().toLocaleTimeString();
    const messageWithTime = `${time} - ${message} `;
    console.warn(messageWithTime.padEnd(lineLength, '*'));
}


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
