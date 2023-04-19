import { XMLParser } from 'fast-xml-parser';
import { AsXmlBuilder } from './AsXmlBuilder';
import { Buffer } from 'node:buffer';

export { AsXmlBuilder };

/**
 * Type alias for a parsed javascript XML object
 */
export type ParsedXmlObject = object;

export class AsXmlParser {

    #parser = new XMLParser({
        /** shared options, keep in sync with {@link AsXmlBuilder} */
        textNodeName: '_txt',
        ignoreAttributes: false,
        attributesGroupName: '_att',
        attributeNamePrefix: '',
        commentPropName: '_cmt',

        // parser only options
        alwaysCreateTextNode: true,
        updateTag: updateTag,
        isArray: checkNodeIsArray,
        trimValues: true,
    });

    /**
     * Parses an XML string to a javascript object representation
     * @param xmlSource An XML document string
     * @returns The javascript object representation of the XML
     * @throws If the XML source is not valid XML
     */
    public parse(xmlSource: string | Buffer): ParsedXmlObject {
        const validate = true;
        const xmlObj: unknown = this.#parser.parse(xmlSource, validate);
        if (typeof xmlObj !== 'object' || xmlObj === null) {
            throw new Error('XML parser did not return an object');
        }
        return xmlObj;
    }
}

const arrayPaths: ReadonlyArray<string> = [
    'Package.Objects.Object',
    'Library.Files.File',
    'Library.Objects.Object',
    'Library.Dependencies.Dependency',
    'Program.Files.File',
    'Program.Objects.Object',
    'Program.Dependencies.Dependency',
    'DataObject.Files.File',
    'DataObject.Objects.Object',
    'Cpu.Objects.Object',
    'Physical.Configurations.Configuration',
    'Physical.Objects.Object',
];
function checkNodeIsArray(
    tagName: string,
    jPath: string,
    isLeafNode: boolean,
    isAttribute: boolean
): boolean {
    return arrayPaths.some((path) => path === jPath);
}


const nodePathIsObjectsRegEx = /^([A-Za-z]+)\.Objects\.Object$/;
const nodePathIsFilesRegEx = /^([A-Za-z]+)\.Files\.File$/;
const nodePathIsConfigurationsRegEx = /^([A-Za-z]+)\.Configurations\.Configuration$/;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function checkNodeIsArrayRegex(tagName: string, jPath: string, isLeafNode: boolean, isAttribute: boolean): boolean {
    //TODO check which variant is better in terms of maintainability (or performance)
    return isAttribute ? false
        : nodePathIsObjectsRegEx.test(jPath) ? true
            : nodePathIsFilesRegEx.test(jPath) ? true
                : nodePathIsConfigurationsRegEx.test(jPath) ? true
                    : false;
}

function updateTag(
    tagName: string,
    jPath: string,
    attrs: { [k: string]: string }
): string | boolean {
    // here we could maybe capture the processing instruction for older AS versions, where there is no attribute format used
    // but it would be probably good to open an issue on fast-xml-parser to properly handle processing instructions, maybe with a user defined callback which gives the whole PI string
    return tagName;
}

