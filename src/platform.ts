import os from "node:os";
import path from "node:path";
import fs from "node:fs";

/**
 * Crea y devuelve la ruta a el directorio de logs
 */
export function logDir(): string {
    let logDirPath: string

    if (process.platform === "win32") {
        logDirPath = path.join(process.env.LOCALAPPDATA!, "osaka", "logs")
    } else if (process.platform === "darwin") {
        logDirPath = path.join(os.homedir(), "Library", "Logs", "osaka")
    } else {
        logDirPath = path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), ".local", "state"), "osaka");
    }

    if (!fs.existsSync(logDirPath)) {
        fs.mkdirSync(logDirPath, {
            recursive: true
        })
    }

    return logDirPath
}