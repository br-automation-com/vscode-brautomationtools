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
