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

import type { Context, Filter } from "grammy"
import { createPrivateChatAgent } from "../agent/agent.js"
import { getAnswer, getContentTypes } from "../agent/response.js"
import { log } from "../logging.js"
import { PinoLangChainHandler } from "../agent/logging.js"
import { getPrivateChatHistory } from "../chat/chat.js"
import { toModelMessage } from "../chat/message.js"

const agent = await createPrivateChatAgent()

export async function handlePrivateMessage(ctx: Filter<Context, "message">): Promise<void> {
    const chatId = ctx.chat.id

    if (!ctx.message.text) {
        return
    }

    const history = getPrivateChatHistory(`telegram:${chatId}`)

    try {
        history.addUserMessage(ctx.message.text)
        const messages = history.messages.map(toModelMessage)
        const result = await agent.invoke({ messages }, { callbacks: [new PinoLangChainHandler(chatId)] })
        const last = result.messages.at(-1)
        const content = last?.content
        const answer = getAnswer(content)

        if (!answer.trim()) {
            log.warn({
                chatId,
                messageType: last?.type,
                contentTypes: getContentTypes(content),
                responseMetadata: last?.response_metadata,
                usageMetadata: last && "usage_metadata" in last ? last.usage_metadata : undefined,
            }, "Model returned no text")

            throw new Error("The model returned an empty answer")
        }

        await ctx.reply(answer)
        history.addAssistantMessage(answer)
    } catch (error) {
        log.error({ err: error, chatId }, "Failed to answer Telegram message")
        await ctx.reply("No he podido responder ahora. Inténtalo de nuevo en un momento.")
    }
}
