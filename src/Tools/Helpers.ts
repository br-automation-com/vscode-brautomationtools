import * as vscode from 'vscode';


export function logTimedHeader(message: string, lineLength: number = 150): void {
    const time = new Date().toLocaleTimeString();
    const separator = ' - ';
    const messageWithTime = time + separator + message + ' ';
    const fillLength = lineLength - messageWithTime.length;
    const fill = (fillLength > 0) ? '*'.repeat(fillLength) : '';
    console.warn(messageWithTime + fill);
}

/**
 * Pushes an item to an array, only if the item is not null or undefined
 * @param array Array to which item is pushed
 * @param item Item which is checked and pushed
 */
export function pushDefined<T>(array: T[], item: T | undefined | null) {
    if (item ?? false) { //TODO test with booleans
        array.push(item!);
    }
}
