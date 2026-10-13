import pino from "pino"
import path from "node:path"
import { logDir } from "./platform.js"

const transport = pino.transport({
    target: 'pino/file',
    options: {
        destination: process.env.NYMPH_LOG_FILE ?? path.join(logDir(), 'nymph.log'),
        mkdir: true,
        append: true
    },
})

export const log = pino({
    level: process.env.NYMPH_LOG_LEVEL ?? 'debug',
}, transport)