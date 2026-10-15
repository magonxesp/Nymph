/**
 * Nymph
 * Copyright (C) 2026  MagonxESP
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

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