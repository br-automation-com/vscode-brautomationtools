/**
 * In here all access to the extension configuration values and TS types of configuration values are handled
 * see https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration
 * @packageDocumentation
 */
//SYNC Needs to be in sync with package.json/contributes/configuration/properties/*

import * as vscode from "vscode";
import { LogAutoShowMode, logger, LogLevel } from "./Tools/Logger";
import { notifications } from "./UI/Notifications";
import { isString, isStringArray } from "./Tools/TypeGuards";

//#region local functions

const configRootKey = "vscode-brautomationtools";

/**
 * Get configuration of this extension
 */
function getConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(configRootKey);
}

/**
 * Convert the configuartion value to LogLevel
 * @param configValue Value which should be converted
 * @returns Returns the LogLevel behind the configValue, or `LogLevel.Debug` if the conversion failed
 */
function toLogLevel(configValue: unknown): LogLevel {
    let result = LogLevel.debug;
    switch (configValue) {
        case "Fatal":
        case LogLevel.fatal:
            result = LogLevel.fatal;
            break;
        case "Error":
        case LogLevel.error:
            result = LogLevel.error;
            break;
        case "Warning":
        case LogLevel.warning:
            result = LogLevel.warning;
            break;
        case "Info":
        case LogLevel.info:
            result = LogLevel.info;
            break;
        case "Detail":
        case LogLevel.detail:
            result = LogLevel.detail;
            break;
        case "Debug":
        case LogLevel.debug:
            result = LogLevel.debug;
            break;
        default:
            logger.warning(`Invalid log level configured, ${LogLevel.debug} level will be used`);
            result = LogLevel.debug;
    }
    return result;
}

/**
 * Convert the configuartion value to LogAutoShowMode
 * @param configValue Value which should be converted
 * @returns Returns the LogAutoShowMode behind the configValue, or `LogAutoShowMode.always` if the conversion failed
 */
function toLogAutoShowMode(configValue: unknown): LogAutoShowMode {
    let result = LogAutoShowMode.always;
    switch (configValue) {
        case "Always":
        case LogAutoShowMode.always:
            result = LogAutoShowMode.always;
            break;
        case "OnFirst":
        case LogAutoShowMode.onFirst:
            result = LogAutoShowMode.onFirst;
            break;
        case "Never":
        case LogAutoShowMode.never:
            result = LogAutoShowMode.never;
            break;
        default:
            logger.warning(`Invalid log auto show mode configured, ${LogAutoShowMode.always} will be used`);
            result = LogAutoShowMode.always;
    }
    return result;
}

//#endregion local functions

/** Extension configuration interface */
class ExtensionConfiguration {
    static #instance: ExtensionConfiguration = new ExtensionConfiguration();
    public static getInstance(): ExtensionConfiguration {
        return this.#instance;
    }
    private constructor() {
        vscode.workspace.onDidChangeConfiguration((ev) => this.#configChangedListener(ev));
    }

    #configChangedListener(ev: vscode.ConfigurationChangeEvent): void {
        const reloadRequiredList = [
            // environment
            "environment.automationStudioInstallPaths",
            "environment.pviInstallPaths",
            // logging
            "logging.logLevel",
            "logging.showOutputOnImportantMessage",
            "logging.prettyPrintAdditionalData",
        ];
        let reloadRequired = false;
        for (const key of reloadRequiredList) {
            const fullKey = `${configRootKey}.${key}`;
            if (ev.affectsConfiguration(fullKey)) {
                reloadRequired = true;
            }
        }
        if (reloadRequired) {
            void notifications.configChangedMessage();
        }
    }

    /** Build configuration */
    public build = new (class {
        constructor(private parent: ExtensionConfiguration) {}

        readonly #defaultBuildModeKey = "build.defaultBuildMode";
        public get defaultBuildMode(): string {
            const value = getConfiguration().get(this.#defaultBuildModeKey);
            if (isString(value)) {
                return value;
            } else {
                logger.warning(`Invalid default build mode configured, "Build" will be used`);
                return "Build";
            }
        }
        public set defaultBuildMode(value: string | undefined) {
            void getConfiguration().update(this.#defaultBuildModeKey, value, vscode.ConfigurationTarget.Global);
        }
    })(this);

    /** Environment configuration */
    public environment = new (class {
        constructor(private parent: ExtensionConfiguration) {}

        readonly #automationStudioInstallPathsKey = "environment.automationStudioInstallPaths";
        public get automationStudioInstallPaths(): vscode.Uri[] {
            const configValue = getConfiguration().get(this.#automationStudioInstallPathsKey);
            if (isStringArray(configValue)) {
                return configValue.map((fsPath) => vscode.Uri.file(fsPath));
            } else {
                logger.error(`Invalid type in configuration of '${this.#automationStudioInstallPathsKey}'`);
                return [];
            }
        }
        public set automationStudioInstallPaths(value: vscode.Uri[] | undefined) {
            const configValue = value?.map((uri) => uri.fsPath);
            void getConfiguration().update(this.#automationStudioInstallPathsKey, configValue, vscode.ConfigurationTarget.Global);
        }

        readonly #pviInstallPathsKey = "environment.pviInstallPaths";
        public get pviInstallPaths(): vscode.Uri[] {
            const configValue = getConfiguration().get(this.#pviInstallPathsKey);
            if (isStringArray(configValue)) {
                return configValue.map((fsPath) => vscode.Uri.file(fsPath));
            } else {
                logger.error(`Invalid type in configuration of '${this.#pviInstallPathsKey}'`);
                return [];
            }
        }
        public set pviInstallPaths(value: vscode.Uri[] | undefined) {
            const configValue = value?.map((uri) => uri.fsPath);
            void getConfiguration().update(this.#pviInstallPathsKey, configValue, vscode.ConfigurationTarget.Global);
        }
    })(this);

    /**Logging configuration */
    public logging = new (class {
        constructor(private parent: ExtensionConfiguration) {}

        readonly #logLevelKey = "logging.logLevel";
        public get logLevel(): LogLevel {
            const value = getConfiguration().get(this.#logLevelKey);
            return toLogLevel(value);
        }
        public set logLevel(value: LogLevel | undefined) {
            void getConfiguration().update(this.#logLevelKey, value, vscode.ConfigurationTarget.Global);
        }

        readonly #showOutputOnImportantMessageKey = "logging.showOutputOnImportantMessage";
        public get showOutputOnImportantMessage(): LogAutoShowMode {
            const value = getConfiguration().get(this.#showOutputOnImportantMessageKey);
            return toLogAutoShowMode(value);
        }
        public set showOutputOnImportantMessage(value: LogAutoShowMode | undefined) {
            void getConfiguration().update(this.#showOutputOnImportantMessageKey, value, vscode.ConfigurationTarget.Global);
        }

        readonly #prettyPrintAdditionalDataKey = "logging.prettyPrintAdditionalData";
        public get prettyPrintAdditionalData(): boolean {
            const value = getConfiguration().get(this.#prettyPrintAdditionalDataKey);
            return value === true ? true : false;
        }
        public set prettyPrintAdditionalData(value: boolean | undefined) {
            void getConfiguration().update(this.#prettyPrintAdditionalDataKey, value, vscode.ConfigurationTarget.Global);
        }
    })(this);

    /** Notification configuration */
    public notifications = new (class {
        constructor(private parent: ExtensionConfiguration) {}

        readonly #hideActivationMessageKey = "notifications.hideActivationMessage";
        public get hideActivationMessage(): boolean {
            const value = getConfiguration().get(this.#hideActivationMessageKey);
            return value === true ? true : false;
        }
        public set hideActivationMessage(value: boolean | undefined) {
            void getConfiguration().update(this.#hideActivationMessageKey, value, vscode.ConfigurationTarget.Global);
        }

        readonly #hideNewVersionMessageKey = "notifications.hideNewVersionMessage";
        public get hideNewVersionMessage(): boolean {
            const value = getConfiguration().get(this.#hideNewVersionMessageKey);
            return value === true ? true : false;
        }
        public set hideNewVersionMessage(value: boolean | undefined) {
            void getConfiguration().update(this.#hideNewVersionMessageKey, value, vscode.ConfigurationTarget.Global);
        }
    })(this);

    /* Template
    public xxxxxx = new class {
        constructor(private parent: ExtensionConfiguration) { }


        readonly #yyyyyyKey = "xxxxxx.yyyyyy";
        public get yyyyyy(): boolean {
            const value = getConfiguration().get(this.#yyyyyyKey);
            return value === true ? true : false;
        }
        public set yyyyyy(value: boolean | undefined) {
            getConfiguration().update(this.#yyyyyyKey, value, vscode.ConfigurationTarget.Global);
        }
    }(this); */
}

/** Access the configuration of the extension */
export const extensionConfiguration = ExtensionConfiguration.getInstance();
