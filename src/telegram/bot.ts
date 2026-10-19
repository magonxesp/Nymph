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

import { Bot } from "grammy"
import { handleGroupMessage } from "./group.js"
import { handlePrivateMessage } from "./private.js"

const token = process.env.NYMPH_TELEGRAM_TOKEN

if (!token) {
    throw new Error("NYMPH_TELEGRAM_TOKEN is required")
}

export const bot = new Bot(token)

bot.command("start", async (ctx) => {
    await ctx.reply("Hola 😊")
})

bot.on("message", async (ctx) => {
    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup"

    if (isGroup) {
        await handleGroupMessage(ctx)
        return
    }

    if (ctx.chat.type === "private") {
        await handlePrivateMessage(ctx)
    }
})
