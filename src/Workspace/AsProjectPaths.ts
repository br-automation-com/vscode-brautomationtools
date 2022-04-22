import * as vscode from 'vscode';
import {pathDirname, pathJoin} from '../Tools/UriTools';

/**
 * General paths of an Automation Studio project
 */
export class AsProjectPaths {

    /**
     * Derive project paths from the project file path
     * @param projectFilePath The path to the project file. e.g. `C:\Projects\Test\Test.apj`
     */
    public constructor(projectFilePath: vscode.Uri) {
        this.#projectFile = projectFilePath;
        this.#projectRoot = pathDirname(this.#projectFile);
        this.#logical = pathJoin(this.#projectRoot, 'Logical');
        this.#physical = pathJoin(this.#projectRoot, 'Physical');
        this.#temp = pathJoin(this.#projectRoot, 'Temp'); //Could be overriden by user settings, which is currently not supported
        this.#tempIncludes = pathJoin(this.#temp, 'Includes');
        this.#binaries = pathJoin(this.#projectRoot, 'Binaries'); //Could be overriden by user settings, which is currently not supported
    }

    /** Root path of the project */
    public get projectRoot(): vscode.Uri {
        return this.#projectRoot;
    }
    #projectRoot: vscode.Uri;

    /** Path to the project file */
    public get projectFile(): vscode.Uri {
        return this.#projectFile;
    }
    #projectFile: vscode.Uri;

    /** Root path of the logical view */
    public get logical(): vscode.Uri {
        return this.#logical;
    }
    #logical: vscode.Uri;

    /** Root path of the physical / configuration view */
    public get physical(): vscode.Uri {
        return this.#physical;
    }
    #physical: vscode.Uri;

    /** Root path of the temporary outputs directory */
    public get temp(): vscode.Uri {
        return this.#temp;
    }
    #temp: vscode.Uri;

    /** Path in the temporary directory where the generated C/C++ headers are stored */
    public get tempIncludes(): vscode.Uri {
        return this.#tempIncludes;
    }
    #tempIncludes: vscode.Uri;

    /** Final binary outputs directory */
    public get binaries(): vscode.Uri {
        return this.#binaries;
    }
    #binaries: vscode.Uri;

    /** toJSON required as getter properties are not shown in JSON.stringify() otherwise */
    public toJSON(): any {
        return {
            projectRoot: this.projectRoot.toString(true),
            projectFile: this.projectFile.toString(true),
            logical: this.logical.toString(true),
            physical: this.physical.toString(true),
            temp: this.temp.toString(true),
            tempIncludes: this.tempIncludes.toString(true),
            binaries: this.binaries.toString(true),
        };
    }
}