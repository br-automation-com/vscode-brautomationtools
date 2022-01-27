/**
 * Helper functions for XML handling
 * @packageDocumentation
 */

import * as xmlDom from '@oozcitak/dom/lib/dom/interfaces';
import { testStringFilter } from './Helpers';

/**
 * Gets all direct children of an XML element node which are also element nodes. Filters can be applied.
 * @param baseElement The base XML element node for which the children are listed.
 * @param nodeNameFilter If set, only child elements with the specified name are returned
 * @param attributeFilter If set, only child elements which have the specified attribute name (and value if set) are returned
 */
export function getChildElements(baseElement: xmlDom.Element, nodeNameFilter?: string | RegExp, attributeFilter?: { name: string, value?: string | RegExp }): xmlDom.Element[] {
    // baseElement.querySelector() is not yet implemented by 'dom' module, so I implemented my own solution getChildElements()
    const childElements: xmlDom.Element[] = [];
    // iterate all child elements
    let nextChild = baseElement.firstElementChild;
    while (nextChild) {
        // iterate
        const actChild = nextChild;
        nextChild = actChild.nextElementSibling;
        // Skip if node name filter does not match
        if (!testStringFilter(actChild.nodeName, nodeNameFilter)) {
            continue;
        }
        // Skip if attribute filter does not match
        if (attributeFilter) {
            // attribute name check
            const attrVal = actChild.getAttribute(attributeFilter.name);
            if (!attrVal) { continue; }
            // attribute value check
            if (!testStringFilter(attrVal, attributeFilter.value)) {
                continue;
            }
        }
        // add to result if all filters passed
        childElements.push(actChild);
    }
    return childElements;
}