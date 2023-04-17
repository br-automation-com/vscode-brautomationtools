/**
 * Logging infrastructure
 * @packageDocumentation
 */


import * as vscode from 'vscode';


//#region exported types


/**
 * Levels for logging
 */
export enum LogLevel {
    /** Fatal error -> extension cannot continue to work */
    fatal = 0,
    /** Error -> Some functionality will not work or some function failed to execute */
    error = 1,
    /** Warning -> Some functionality may be limited */
    warning = 2,
    /** Info -> Normal insight to whats happening */
    info = 3,
    /** Detail -> Detailed insight what is happening */
    detail = 4,
    /** Debug -> All information for debugging purposes */
    debug = 5
}

/**
 * Mode for showing log output on important messages
 */
export enum LogAutoShowMode {
    /** Show on every new important message */
    always = 0,
    /** Show only the first time an important message is written */
    onFirst = 1,
    /** Never show automatically */
    never = 2,
}


/**
 * Configuration of the logger
 */
export interface LogConfiguration {
    /** Used level for logging. All log messages with a lower level will not be written */
    level: LogLevel;
    /** If activated, the log output will be automatically shown on messages of level Warning or higher */
    showOutputOnImportantMessage: LogAutoShowMode,
    /** Additional data pretty print */
    prettyPrintAdditionalData: boolean;
}


export interface LogEntryAdditionalData {
    [data: string]: any;
}


/**
 * 
 */
export class LogEntry {
    public readonly timestamp: Date;
    public readonly level: LogLevel;
    public readonly message: string;
    public readonly addData?: LogEntryAdditionalData; // Additional type so expected logging of 'undefined' can be distinguished from unused property 'LogEntry.data'


    constructor(level: LogLevel, message: string, data?: LogEntryAdditionalData) {
        this.timestamp = new Date();
        this.level = level;
        this.message = message;
        this.addData = data;
    }
}


//#endregion exported types


//#region exported classes


class Logger {
    /** Default logger instance */
    public static readonly default: Logger = new Logger();


    /** The configuration of the logger */
    public get configuration() {
        return this.#configuration;
    }
    /** The configuration of the logger */
    public set configuration(configuration: LogConfiguration) {
        this.#configuration = configuration;
        this.#setLogFunctions();
    }
    #configuration: LogConfiguration = {
        level: LogLevel.debug,
        showOutputOnImportantMessage: LogAutoShowMode.always,
        prettyPrintAdditionalData: false
    };


    /** Write log with level fatal */
    public get fatal() {
        return this.#fatal;
    }
    private set fatal(logFunction: LogFunction) {
        this.#fatal = logFunction;
    }
    #fatal: LogFunction = this.#logDummy;


    /** Write log with level error */
    public get error() {
        return this.#error;
    }
    private set error(logFunction: LogFunction) {
        this.#error = logFunction;
    }
    #error: LogFunction = this.#logDummy;


    /** Write log with level warning */
    public get warning() {
        return this.#warning;
    }
    private set warning(logFunction: LogFunction) {
        this.#warning = logFunction;
    }
    #warning: LogFunction = this.#logDummy;


    /** Write log with level info */
    public get info() {
        return this.#info;
    }
    private set info(logFunction: LogFunction) {
        this.#info = logFunction;
    }
    #info: LogFunction = this.#logDummy;


    /** Write log with level verbose */
    public get detail() {
        return this.#detail;
    }
    private set detail(logFunction: LogFunction) {
        this.#detail = logFunction;
    }
    #detail: LogFunction = this.#logDummy;


    /** Write log with level debug */
    public get debug() {
        return this.#debug;
    }
    private set debug(logFunction: LogFunction) {
        this.#debug = logFunction;
    }
    #debug: LogFunction = this.#logDummy;

    /**
     * Formats a URI for display in a log message. Already includes ""
     */
    public formatUri(uri: vscode.Uri | undefined): string {
        return `"${uri?.fsPath}"`;
    }

    /**
     * Formats an error for display in a log message. Use it in a catch block to log the catched object.
     */
    public formatError(error: unknown): string {
        return error instanceof Error ? `(${error.message})` : `(No error details available!)`;
    }

    /** Shows the logger in the UI */
    public showOutput() {
        Logger.#logChannel.show(true);
    }


    /** Create Logger with default settings */
    constructor() {
        this.#setLogFunctions();
    }


    /** VS Code output channel used for logging */
    static #logChannel = vscode.window.createOutputChannel('vscode-brautomationtools');


    /** Set the log function properties depending on the configuration */
    #setLogFunctions() {
        switch (this.configuration.level) {
            case LogLevel.fatal:
                this.fatal = this.#logFatal;
                this.error = this.#logDummy;
                this.warning = this.#logDummy;
                this.info = this.#logDummy;
                this.detail = this.#logDummy;
                this.debug = this.#logDummy;
                break;

            case LogLevel.error:
                this.fatal = this.#logFatal;
                this.error = this.#logError;
                this.warning = this.#logDummy;
                this.info = this.#logDummy;
                this.detail = this.#logDummy;
                this.debug = this.#logDummy;
                break;

            case LogLevel.warning:
                this.fatal = this.#logFatal;
                this.error = this.#logError;
                this.warning = this.#logWarning;
                this.info = this.#logDummy;
                this.detail = this.#logDummy;
                this.debug = this.#logDummy;
                break;

            case LogLevel.info:
                this.fatal = this.#logFatal;
                this.error = this.#logError;
                this.warning = this.#logWarning;
                this.info = this.#logInfo;
                this.detail = this.#logDummy;
                this.debug = this.#logDummy;
                break;

            case LogLevel.detail:
                this.fatal = this.#logFatal;
                this.error = this.#logError;
                this.warning = this.#logWarning;
                this.info = this.#logInfo;
                this.detail = this.#logDetail;
                this.debug = this.#logDummy;
                break;

            case LogLevel.debug:
                this.fatal = this.#logFatal;
                this.error = this.#logError;
                this.warning = this.#logWarning;
                this.info = this.#logInfo;
                this.detail = this.#logDetail;
                this.debug = this.#logDebug;
                break;

            default:
                this.fatal = this.#logFatal;
                this.error = this.#logError;
                this.warning = this.#logWarning;
                this.info = this.#logInfo;
                this.detail = this.#logDetail;
                this.debug = this.#logDebug;
                break;
        }
    }


    /**
     * Returns a formatted string representation of the logEntry.
     * @a '[11:33:42.007 - Fatal] My message' without additional data
     * @b '[11:33:42.007 - Fatal] My message ({someProp:"hello"})' with additional data
     * @param logEntry the log entry which will be formatted
     * @returns Formatted string representation of the log entry
     */
    #formatLogEntry(logEntry: LogEntry): string {
        // header '[11:33:42.007 - Fatal]'
        const time = logEntry.timestamp.toLocaleTimeString();
        const millis = logEntry.timestamp.getMilliseconds().toString().padStart(3, '0');
        const level = LogLevel[logEntry.level].padStart(7, ' ');
        const header = `[${time}.${millis} - ${level}]`;
        // message and if existing additional data
        const message = logEntry.message;
        let additionalData: string = '';
        if (logEntry.addData) {
            const undefReplacer = (key: string, val: any) => (val === undefined ? null : val);
            if (this.configuration.prettyPrintAdditionalData) {
                additionalData = `\n${JSON.stringify(logEntry.addData, undefReplacer, 2)}`;
            } else {
                additionalData = ` ${JSON.stringify(logEntry.addData, undefReplacer)}`;
            }
        }
        // formatted message '[11:33:42.007 - Fatal] My message {data: {someProp:"hello"}}'
        return `${header} ${message}${additionalData}`;
    }


    /** Base log function which generates the output */
    #logBase(logEntry: LogEntry) {
        Logger.#logChannel.appendLine(this.#formatLogEntry(logEntry));
    }


    /** Dummy function which does not create any output.
     * This function can be assigned to function properties which should not generate output
     * for the configured level.
     */
    #logDummy(message: string, additionalData?: LogEntryAdditionalData) {
        // do nothing
    }

    /** Default implementation for a 'fatal' log entry */
    #logFatal(message: string, additionalData?: LogEntryAdditionalData) {
        const entry = new LogEntry(LogLevel.fatal, message, additionalData);
        this.#logBase(entry);
        this.#showOutputOnImportantMessage();
    }

    /** Default implementation for a 'error' log entry */
    #logError(message: string, additionalData?: LogEntryAdditionalData) {
        const entry = new LogEntry(LogLevel.error, message, additionalData);
        this.#logBase(entry);
        this.#showOutputOnImportantMessage();
    }

    /** Default implementation for a 'warning' log entry */
    #logWarning(message: string, additionalData?: LogEntryAdditionalData) {
        const entry = new LogEntry(LogLevel.warning, message, additionalData);
        this.#logBase(entry);
        this.#showOutputOnImportantMessage();
    }

    /** Default implementation for a 'info' log entry */
    #logInfo(message: string, additionalData?: LogEntryAdditionalData) {
        const entry = new LogEntry(LogLevel.info, message, additionalData);
        this.#logBase(entry);
    }

    /** Default implementation for a 'detail' log entry */
    #logDetail(message: string, additionalData?: LogEntryAdditionalData) {
        const entry = new LogEntry(LogLevel.detail, message, additionalData);
        this.#logBase(entry);
    }

    /** Default implementation for a 'debug' log entry */
    #logDebug(message: string, additionalData?: LogEntryAdditionalData) {
        const entry = new LogEntry(LogLevel.debug, message, additionalData);
        this.#logBase(entry);
    }

    /** Show the output channel on an important message, depending on the configuration */
    #showOutputOnImportantMessage() {
        switch (this.#configuration.showOutputOnImportantMessage) {
            case LogAutoShowMode.always:
                this.showOutput();
                break;
            case LogAutoShowMode.onFirst:
                if (!this.#importantMessageShown) {
                    this.showOutput();
                    this.#importantMessageShown = true;
                }
                break;
            case LogAutoShowMode.never:
                // do not show
                break;
            default:
                this.showOutput();
                break;
        }
    }
    /** Flag for LogAutoShowMode.onFirst */
    #importantMessageShown = false;
}


//#endregion exported classes


//#region exported functions


//#endregion exported functions


//#region exported variables


export const logger = Logger.default;


//#endregion exported variables


//#region local types


type LogFunction = (message: string, additionalData?: LogEntryAdditionalData) => void;


//#endregion local types