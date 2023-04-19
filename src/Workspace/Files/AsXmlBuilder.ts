import { XMLBuilder } from 'fast-xml-parser';
import { logger } from '../../Tools/Logger';
import { ParsedXmlObject } from './AsXmlParser';

export class AsXmlBuilder {

    #builder = new XMLBuilder({
        // shared options, keep in sync with AsXmlParser
        textNodeName: '_txt',
        ignoreAttributes: false,
        attributesGroupName: '_att',
        attributeNamePrefix: '',
        commentPropName: '_cmt',
        suppressBooleanAttributes: false,

        // Builder only options
        format: true,
        suppressEmptyNode: true,
        indentBy: '  ',
    });

    public build(xmlObj: ParsedXmlObject): string {
        const buildResult = this.#builder.build(xmlObj) as unknown;
        if (typeof buildResult !== 'string') {
            logger.error('AsXmlBuilder buildResult is not of type string!');
            return '';
        }
        return this.#reformatXml(buildResult);
    }

    #reformatXml(inputXml: string): string {
        let result = inputXml;
        result = makeSpaceOnSelfClosingTag(result);
        result = toCrLf(result);
        result = result.trim();
        return result;
    }
}

function makeSpaceOnSelfClosingTag(xmlBefore: string): string {
    // HACK workaround which is required until https://github.com/NaturalIntelligence/fast-xml-parser/issues/560 is solved
    const selfClosingRegex = /([^\s])\s*\/>/gm;
    const subst = `$1 />`;
    return xmlBefore.replace(selfClosingRegex, subst);
}

function toCrLf(value: string): string {
    return value.replace(/(?:\r\n|\r|\n)/g, '\r\n');
}