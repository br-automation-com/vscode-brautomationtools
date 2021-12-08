/**
 * In here all access to the extension configuration values and TS types of configuration values are handled
 * see https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration
 * @packageDocumentation
 */
//SYNC Needs to be in sync with package.json/contributes/configuration/properties/*

import * as vscode from 'vscode';
import { LogLevel } from './BrLog';


//#region definitions and types from package.json contribution points
// No complex types contributed yet
//#endregion definitions and types from package.json contribution points

//#region setting of values
// No setters yet
//#endregion setting of values

//#region getting of values


/**
 * Gets the configured Automation Studio install paths.
 */
export function getAutomationStudioInstallPaths(): vscode.Uri[] {
    //TODO error checking if types do not match (both directions read and write) -> is this possible somehow?
    const config = getConfiguration();
    const configValue = config.get<string[]>('environment.automationStudioInstallPaths');
    if (configValue) {
        return configValue.map(fsPath => vscode.Uri.file(fsPath));
    }
    else {
        return [];
    }
}


/**
 * Gets the configured PVI install paths.
 */
export function getPviInstallPaths(): vscode.Uri[] {
    //TODO error checking if types do not match (both directions read and write) -> is this possible somehow?
    const config = getConfiguration();
    const configValue = config.get<string[]>('environment.pviInstallPaths');
    if (configValue) {
        return configValue.map(fsPath => vscode.Uri.file(fsPath));
    }
    else {
        return [];
    }
}


/**
 * Gets the default build mode.
 */
export function getDefaultBuildMode() {
    //TODO error checking if types do not match (both directions read and write) -> is this possible somehow?
    const config = getConfiguration();
    const test = config.inspect('build.defaultBuildMode');
    console.log(test);
    return config.get<string>('build.defaultBuildMode');

}


/**
 * Gets the configured log level
 */
export function getLogLevel() {
    //TODO error checking if types do not match (both directions read and write) -> is this possible somehow?
    const config = getConfiguration();
    //TODO doesn't work! String is used instead...
    //const value = config.get<LogLevel>('logging.logLevel');
    //HACK: compare and set...
    const configValue = config.get<string>('logging.logLevel');
    let result = LogLevel.Debug;
    switch (configValue) {
        case "Fatal":
            result = LogLevel.Fatal;
            break;
        case "Error":
            result = LogLevel.Error;
            break;
        case "Warning":
            result = LogLevel.Warning;
            break;
        case "Info":
            result = LogLevel.Info;
            break;
        case "Debug":
            result = LogLevel.Debug;
            break;
    }
    return result;

}


//#endregion getting of values


//#region local functions


/**
 * Get configuration of this extension
 */
function getConfiguration() {
    return vscode.workspace.getConfiguration('vscode-brautomationtools');
}


//#endregion local functions


/** Implementation of the extension state interface */
class ExtensionConfiguration {
    static #instance: ExtensionConfiguration = new ExtensionConfiguration();
    public static getInstance(): ExtensionConfiguration {
        return this.#instance;
    }


    private constructor() { };


    /** VS Code extension context */
    #context?: vscode.ExtensionContext = undefined;


    /**
     * Initialize the extension state
     * @param context The context of the extension
     */
    initialize(context: vscode.ExtensionContext): void {
        this.#context = context;
    }


    /** Notification configuration */
    public notifications = new class {
        constructor(private parent: ExtensionConfiguration) { }


        readonly #hideActivationMessageKey = "notifications.hideActivationMessage";
        public get hideActivationMessage(): boolean {
            const value = getConfiguration().get(this.#hideActivationMessageKey);
            return value === true ? true : false;
        }
        public set hideActivationMessage(value: boolean | undefined) {
            getConfiguration().update(this.#hideActivationMessageKey, value, vscode.ConfigurationTarget.Global);
        }


        readonly #hideNewVersionMessageKey = "notifications.hideNewVersionMessage";
        public get hideNewVersionMessage(): boolean {
            const value = getConfiguration().get(this.#hideNewVersionMessageKey);
            return value === true ? true : false;
        }
        public set hideNewVersionMessage(value: boolean | undefined) {
            getConfiguration().update(this.#hideNewVersionMessageKey, value, vscode.ConfigurationTarget.Global);
        }
    }(this);


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

/** Access the stored state of the extension (key value pairs) */
export const extensionConfiguration = ExtensionConfiguration.getInstance();