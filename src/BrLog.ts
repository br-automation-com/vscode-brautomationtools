/**
 * Logging infrastructure
 * @packageDocumentation
 */


import * as vscode from 'vscode';


//#region exported types


//TODO export variable 'logger' which can be used by everyone
//     Currently there is a static getter on the Logger class (Logger.default)
//export const logger: Logger = new Logger();


/**
 * Levels for logging
 */
export enum LogLevel {
    /** Fatal error -> extension cannot continue to work */
    Fatal = 0,
    /** Error -> Some functionality will not work or some function failed to execute */
    Error = 1,
    /** Warning -> Some functionality may be limited */
    Warning = 2,
    /** Info -> Normal insight to whats happening */
    Info = 3,
    /** Debug -> Detailed insight what is happening */
    Debug = 4
}


/**
 * Configuration of the logger
 */
export interface LogConfiguration {
    /** Used level for logging. All log messages with a lower level will not be written */
    level: LogLevel;
}


export interface LogEntryAdditionalData {
    data ?: any;
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


export class Logger {
    /** Default logger instance */
    public static readonly default: Logger = new Logger();


    /** The configuration of the logger */
    public get configuration() {
        return this._configuration;
    }
    /** The configuration of the logger */
    public set configuration(configuration: LogConfiguration) {
        this._configuration = configuration;
        this._setLogFunctions();
    }
    private _configuration: LogConfiguration = {
        level: LogLevel.Debug
    };


    /** Write log with level fatal */
    public get fatal() {
        return this._fatal;
    }
    private set fatal(logFunction: LogFunction) {
        this._fatal = logFunction;
    }
    private _fatal: LogFunction = this._logDummy;


    /** Write log with level error */
    public get error() {
        return this._error;
    }
    private set error(logFunction: LogFunction) {
        this._error = logFunction;
    }
    private _error: LogFunction = this._logDummy;


    /** Write log with level warning */
    public get warning() {
        return this._warning;
    }
    private set warning(logFunction: LogFunction) {
        this._warning = logFunction;
    }
    private _warning: LogFunction = this._logDummy;


    /** Write log with level info */
    public get info() {
        return this._info;
    }
    private set info(logFunction: LogFunction) {
        this._info = logFunction;
    }
    private _info: LogFunction = this._logDummy;


    /** Write log with level debug */
    public get debug() {
        return this._debug;
    }
    private set debug(logFunction: LogFunction) {
        this._debug = logFunction;
    }
    private _debug: LogFunction = this._logDummy;


    /** Create Logger with default settings */
    constructor()
    {
        this._setLogFunctions();
    }


    /** VS Code output channel used for logging */
    private static _logChannel = vscode.window.createOutputChannel('vscode-brautomationtools');


    /** Set the log function properties depending on the configuration */
    private _setLogFunctions() {
        switch (this.configuration.level) {
            case LogLevel.Fatal:
                this.fatal = this._logFatal;
                this.error = this._logDummy;
                this.warning = this._logDummy;
                this.info = this._logDummy;
                this.debug = this._logDummy;
                break;

            case LogLevel.Error:
                this.fatal = this._logFatal;
                this.error = this._logError;
                this.warning = this._logDummy;
                this.info = this._logDummy;
                this.debug = this._logDummy;
                break;

            case LogLevel.Warning:
                this.fatal = this._logFatal;
                this.error = this._logError;
                this.warning = this._logWarning;
                this.info = this._logDummy;
                this.debug = this._logDummy;
                break;

            case LogLevel.Info:
                this.fatal = this._logFatal;
                this.error = this._logError;
                this.warning = this._logWarning;
                this.info = this._logInfo;
                this.debug = this._logDummy;
                break;

            case LogLevel.Debug:
                this.fatal = this._logFatal;
                this.error = this._logError;
                this.warning = this._logWarning;
                this.info = this._logInfo;
                this.debug = this._logDebug;
                break;

            default:
                this.fatal = this._logFatal;
                this.error = this._logError;
                this.warning = this._logWarning;
                this.info = this._logInfo;
                this.debug = this._logDebug;
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
    private _formatLogEntry(logEntry: LogEntry): string {
        // header '[11:33:42.007 - Fatal]'
        const time = logEntry.timestamp.toLocaleTimeString();
        const millis = logEntry.timestamp.getMilliseconds().toString().padStart(3, "0");
        const level = LogLevel[logEntry.level].padStart(5, " ");
        const header = `[${time}.${millis} - ${level}]`;
        // message and if existing additional data
        const message = logEntry.message;
        const additionalData = (logEntry.addData === undefined) ? "" : `(${JSON.stringify(logEntry.addData.data)})`;
        // formatted message '[11:33:42.007 - Fatal] My message ({someProp:"hello"})'
        return `${header} ${message} ${additionalData}`;
    }


    /** Base log function which generates the output */
    private _logBase(logEntry: LogEntry) {
        Logger._logChannel.appendLine(this._formatLogEntry(logEntry));
    }


    /** Dummy function which does not create any output.
     * This function can be assigned to function properties which should not generate output
     * for the configured level.
     */
    private _logDummy(message: string, additionalData?: LogEntryAdditionalData) {
        // do nothing
    }


    private _logFatal(message: string, additionalData?: LogEntryAdditionalData) {
        const entry = new LogEntry(LogLevel.Fatal, message, additionalData);
        this._logBase(entry);
    }


    private _logError(message: string, additionalData?: LogEntryAdditionalData) {
        const entry = new LogEntry(LogLevel.Error, message, additionalData);
        this._logBase(entry);
    }


    private _logWarning(message: string, additionalData?: LogEntryAdditionalData) {
        const entry = new LogEntry(LogLevel.Warning, message, additionalData);
        this._logBase(entry);
    }


    private _logInfo(message: string, additionalData?: LogEntryAdditionalData) {
        const entry = new LogEntry(LogLevel.Info, message, additionalData);
        this._logBase(entry);
    }


    private _logDebug(message: string, additionalData?: LogEntryAdditionalData) {
        const entry = new LogEntry(LogLevel.Debug, message, additionalData);
        this._logBase(entry);
    }
}


//#endregion exported classes


//#region exported functions


//#endregion exported functions


//#region local variables


//#endregion local variables


//#region local types


type LogFunction = (message: string, additionalData?: LogEntryAdditionalData) => void;


//#endregion local types