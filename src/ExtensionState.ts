/**
 * Handles the stored states of the extension (ExtensionContext.globalState / ExtensionContext.workspaceState)
 * @packageDocumentation
 */

import * as vscode from "vscode";
import { isString } from "./Tools/TypeGuards";

/** Extension state interface */
class ExtensionState {
    static #instance: ExtensionState = new ExtensionState();
    public static getInstance(): ExtensionState {
        return this.#instance;
    }

    private constructor() {}

    /** VS Code extension context */
    #context?: vscode.ExtensionContext = undefined;
    /** Keys which will be synchronised with VS Code settings sync */
    readonly #keysForSync: string[] = [];

    /**
     * Initialize the extension state
     * @param context The context of the extension
     */
    initialize(context: vscode.ExtensionContext): void {
        this.#context = context;
        this.#context.globalState.setKeysForSync(this.#keysForSync);
    }

    /** State of notifications */
    public notifications = new (class {
        constructor(private parent: ExtensionState) {
            parent.#keysForSync.push(this.#lastShownVersionKey);
        }

        readonly #lastShownVersionKey = "notifications.lastShownVersion";
        public get lastShownVersion(): string | undefined {
            const value = this.parent.#context?.globalState.get<string>(this.#lastShownVersionKey);
            return isString(value) ? value : undefined;
        }
        public set lastShownVersion(value: string | undefined) {
            void this.parent.#context?.globalState.update(this.#lastShownVersionKey, value);
        }
    })(this);
}

/** Access the stored state of the extension (key value pairs) */
export const extensionState = ExtensionState.getInstance();
