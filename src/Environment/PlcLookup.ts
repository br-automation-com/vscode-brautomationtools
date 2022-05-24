import { logger } from '../Tools/Logger';
import { SystemGeneration, TargetArchitecture } from './CommonTypes';

/** Properties of a PLC type */
export interface PlcProperties {
    /** System generation of the PLC */
    readonly systemGeneration: SystemGeneration,
    /** CPU architecture of the PLC */
    readonly architecture: TargetArchitecture,
    /** Free text family name for diagnostics of RegEx */
    readonly familyName: string | undefined,
}

/**
 * Get the properties of a PLC module ID from a lookup table
 * @param moduleId Module ID of the PLC
 * @returns The properties of the PLC
 */
export function getPlcProperties(moduleId?: string): PlcProperties {
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
    familyName: undefined,
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
    // Generic
    { pattern: /^PC_any/i, props: { systemGeneration: 'SG4', architecture: 'IA32', familyName: 'Standard PC (ArSim)' } },
    // X20CP / X20EM
    { pattern: /^X20c?CP13\d\d/i, props: { systemGeneration: 'SG4', architecture: 'IA32', familyName: 'X20(c)CP13xx(-RT)' } },
    { pattern: /^X20c?CP[1,3]4\d\d/i, props: { systemGeneration: 'SG4', architecture: 'IA32', familyName: 'X20(c)CP14xx(-1) / X20(c)CP34xx(-1)' } },
    { pattern: /^X20c?CP[1,3]5\d\d/i, props: { systemGeneration: 'SG4', architecture: 'IA32', familyName: 'X20(c)CP15xx / X20(c)CP35xx' } },
    { pattern: /X20c?CP[1,3]6\d\dX?/i, props: { systemGeneration: 'SG4', architecture: 'IA32', familyName: 'X20(c)CP16xx(X) / X20(c)CP36xx(X)' } },
    { pattern: /^X20c?CP04\d\d/i, props: { systemGeneration: 'SG4', architecture: 'Arm', familyName: 'X20(c)CP04xx(-1)' } },
    { pattern: /X20c?EM[0,1]6\d\d/i, props: { systemGeneration: 'SG4', architecture: 'IA32', familyName: 'X20(c)EM06xx / X20(c)EM16xx' } },
    // X90CP
    { pattern: /^X90CP17\d\.\d\d/i, props: { systemGeneration: 'SG4', architecture: 'Arm', familyName: 'X90CP17x.xx(-xx)' } },
    // APC / PPC / MPC
    { pattern: /^5[AP]PC2100/i, props: { systemGeneration: 'SG4', architecture: 'IA32', familyName: 'APC2100 / PPC2100' } },
    { pattern: /^5[AP]PC2200/i, props: { systemGeneration: 'SG4', architecture: 'IA32', familyName: 'APC2200 / PPC2200' } },
    { pattern: /^5[APM]PC3100/i, props: { systemGeneration: 'SG4', architecture: 'IA32', familyName: 'APC3100 / PPC3100 / MPC3100' } },
    { pattern: /^5PC90[01]/i, props: { systemGeneration: 'SG4', architecture: 'IA32', familyName: 'APC910 / PPC910' } },
    // Power Panel C30 / C50 / C70 / C80
    { pattern: /^4PPC30.\d\d\d\w-\d\d\w/i, props: { systemGeneration: 'SG4', architecture: 'Arm', familyName: 'Power Panel C30' } },
    { pattern: /^4PPC50.\d\d\d\w-\d\d\w/i, props: { systemGeneration: 'SG4', architecture: 'Arm', familyName: 'Power Panel C50' } },
    { pattern: /^4PPC70.\d\d\d\w-\d\d\w/i, props: { systemGeneration: 'SG4', architecture: 'IA32', familyName: 'Power Panel C70' } },
    { pattern: /^4PPC80.\d\d\d\w-\d\d\w/i, props: { systemGeneration: 'SG4', architecture: 'IA32', familyName: 'Power Panel C80' } },
    // Template
    //{ pattern: /XXXX/i, props: { systemGeneration: 'GGG', architecture: 'YYY', familyName: 'XXXXXXX' } }, // TEMPLATE
];