import { logger } from '../Tools/Logger';
import { SystemGeneration, TargetArchitecture } from './CommonTypes';

export interface PlcProperties {
    readonly systemGeneration: SystemGeneration,
    readonly architecture: TargetArchitecture,
}

export function getPlcProperties(moduleId?: string): PlcProperties {
    //TODO implement test for function
    if (moduleId === undefined) {
        return fallbackProperties;
    }
    const match = lookupTable.find((entry) => entry.pattern.test(moduleId));
    if (match !== undefined) {
        return match.props;
    }
    logger.warning(`PLC type "${moduleId}" was not found in property lookup table. Please open an issue on "https://github.com/br-automation-com/vscode-brautomationtools/issues"`);
    return fallbackProperties;
}

const fallbackProperties: PlcProperties = {
    systemGeneration: 'SG4',
    architecture: 'IA32',
};

/** Lookup table entry */
interface LookupEntry {
    /** Pattern for PLC moduleId */
    pattern: RegExp,
    /** Properties of the PLC type */
    props: PlcProperties,
}

/**
 * Lookup table for PLC properties
 * Do not make the pattern too generic, as:
 * - It might match another similar moduleId with different properties
 * - Other PLC properties might be added in future, which might differ for currently similar PLC types
 */
const lookupTable: LookupEntry[] = [
    // SG4 IA32
    { pattern: /^X20c?CP[1,3]4\d{2}/i, props: { systemGeneration: 'SG4', architecture: 'IA32', } },    // X20(c)CP14xx(-1) / X20(c)CP34xx(-1)
    { pattern: /^X20c?CP[1,3]5\d{2}/i, props: { systemGeneration: 'SG4', architecture: 'IA32', } },     // X20(c)CP15xx / X20(c)CP35xx
    { pattern: /X20c?CP[1,3]6\d{2}X?/i, props: { systemGeneration: 'SG4', architecture: 'IA32', } },    // X20(c)CP16xx(X) / X20(c)CP36xx(X)
    { pattern: /X20c?EM[0,1]6\d{2}/i, props: { systemGeneration: 'SG4', architecture: 'IA32', } },      // X20(c)EM06xx / X20(c)EM16xx
    { pattern: /^5[AP]PC2100/i, props: { systemGeneration: 'SG4', architecture: 'IA32', } },            // APC2100 / PPC2100
    { pattern: /^5[AP]PC2200/i, props: { systemGeneration: 'SG4', architecture: 'IA32', } },            // APC2200 / PPC2200
    { pattern: /^5[AP]PC3100/i, props: { systemGeneration: 'SG4', architecture: 'IA32', } },            // APC3100 / PPC3100
    //TODO APC910
    //TODO X90 APC
    //{ pattern: /XXXX/i, props: { systemGeneration: 'SG4', architecture: 'IA32', } }, // TEMPLATE

    // SG4 Arm
    { pattern: /^X20c?CP04\d{2}/i, props: { systemGeneration: 'SG4', architecture: 'Arm', } },          // X20(c)CP04xx(-1)
    { pattern: /^X90CP17\d\.\d{2}/i, props: { systemGeneration: 'SG4', architecture: 'Arm', } },        // X90CP17x.xx(-xx)
    //{ pattern: /XXXX/i, props: { systemGeneration: 'SG4', architecture: 'Arm', } }, // TEMPLATE

    // SG3 M68K
    //TODO some targets
    //{ pattern: /XXXX/i, props: { systemGeneration: 'SG4', architecture: 'M68K', } }, // TEMPLATE
];