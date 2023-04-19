import * as vscode from "vscode";
import * as childProcess from "child_process";

export interface ExecuteResult {
    exitCode: number;
    stdout: {
        string: string;
        chunks: unknown[];
        stringChunks: string[];
    };
    stderr: {
        string: string;
        chunks: unknown[];
        stringChunks: string[];
    };
}

/**
 * Spawn process async.
 * Can be useful to spawn multiple processes in parallel and afterwards await all (Promise.all()), or do other stuff during process execution.
 * For single runs, the original spawnSync has slightly better performance.
 * @param executable
 * @param args
 * @returns
 */
export async function spawnAsync(executable: vscode.Uri, ...args: string[]): Promise<ExecuteResult> {
    //https://stackoverflow.com/questions/56460290/read-everything-from-child-process-spawns-stderr-in-nodejs
    //https://stackoverflow.com/a/58571306/6279206
    const child = childProcess.spawn(executable.fsPath, args);
    const dataChunks = [];
    //child.stdout.on('data', (chunk) => (dataChunks.push(chunk)));
    for await (const chunk of child.stdout) {
        dataChunks.push(chunk);
    }
    const errorChunks = [];
    for await (const chunk of child.stderr) {
        errorChunks.push(chunk);
    }
    const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("close", (code) => {
            resolve(code ?? 0);
        });
    });
    const result: ExecuteResult = {
        exitCode: exitCode,
        stdout: {
            chunks: dataChunks,
            stringChunks: dataChunks.map((chunk) => String(chunk)),
            string: dataChunks.join(""),
        },
        stderr: {
            chunks: errorChunks,
            stringChunks: errorChunks.map((chunk) => String(chunk)),
            string: errorChunks.join(""),
        },
    };
    return result;
}
