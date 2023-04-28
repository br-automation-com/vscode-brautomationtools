/**
 * Typeguards to check object types, especially when reading from json data,
 * global / workspace state or from the configuration.
 * @packageDocumentation
 */

/**
 * Checks if a value is an array containing only `string` values (or no values).
 * Boxed `String` objects in the array will return false.
 * @param value Value to be checked
 * @returns true if value is a `string[]`, false otherwise
 */
export function isStringArray(value: unknown): value is string[] {
    if (!Array.isArray(value)) {
        return false;
    }
    for (const elem of value) {
        if (!isString(elem)) {
            return false;
        }
    }
    return true;
}

/**
 * Checks if a value is a primitive `string`.
 * Boxed `String` objects will return false.
 * @param value Value to be checked
 * @returns true if value is a primitive `string`, false otherwise
 */
export function isString(value: unknown): value is string {
    if (typeof value === "string") {
        return true;
    } else {
        return false;
    }
}

/**
 * Checks if a value is of type `object` and not `null`
 * @param value The value to be checked
 * @returns true if typeof value === "object" && value !== null
 */
export function isNonNullObject(value: unknown): value is object {
    return typeof value === "object" && value !== null;
}
