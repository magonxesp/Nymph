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
import { readFile } from "node:fs/promises"
import path from "node:path"
import { agent } from "./agent/agent.js"
import { getAnswer, getContentTypes } from "./agent/response.js"
import { log } from "./logging.js"
import { PinoLangChainHandler } from "./agent/logging.js"
import { getPrivateChatHistory } from "./chat/chat.js"
import { getGroupChatHistory } from "./chat/group.js"
import { compileGroupTriggers, matchesGroupTrigger, mentionsBot } from "./chat/group-triggers.js"
import { toModelMessage } from "./chat/message.js"
import {promptsDir, rootDir} from "./env.js"
import { HumanMessage } from "@langchain/core/messages"

const groupResponsePrompt = await readFile(path.join(promptsDir, "group-response.md"), "utf8")
const groupTriggers = compileGroupTriggers(await readFile(path.join(rootDir, "group-triggers.txt"), "utf8"))

const token = process.env.NYMPH_TELEGRAM_TOKEN

if (!token) {
    throw new Error("NYMPH_TELEGRAM_TOKEN is required")
}

export const bot = new Bot(token)

bot.command("start", async (ctx) => {
    await ctx.reply("Hola 😊")
})

bot.on("message", async (ctx) => {
    const chatId = ctx.chat.id
    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup"

    if (isGroup) {
        const history = getGroupChatHistory(`telegram:${chatId}`)
        const sender = ctx.from
        const senderChat = ctx.message.sender_chat
        const messageText = ctx.message.text ?? ctx.message.caption
        const mentionEntities = ctx.message.text ? ctx.message.entities : ctx.message.caption_entities

        history.addMessage({
            id: ctx.message.message_id,
            senderId: senderChat ? String(senderChat.id) : String(sender?.id ?? "unknown"),
            senderName: senderChat?.title ?? (sender ? [sender.first_name, sender.last_name].filter(Boolean).join(" ") : "Desconocido"),
            text: messageText ?? "[mensaje sin texto]",
            timestamp: ctx.message.date
        })

        const triggeredByPattern = messageText ? matchesGroupTrigger(messageText, groupTriggers) : false
        const triggeredByMention = messageText
            ? mentionsBot(messageText, mentionEntities ?? [], ctx.me.id, ctx.me.username)
            : false

        if (!triggeredByPattern && !triggeredByMention) {
            return
        }

        try {
            const messages = [new HumanMessage(`${groupResponsePrompt}\n\n${history.toXml(ctx.message.message_id)}`)]
            const result = await agent.invoke({ messages }, { callbacks: [new PinoLangChainHandler(chatId)] })
            const last = result.messages.at(-1)
            const content = last?.content
            const answer = getAnswer(content)

            if (!answer.trim()) {
                log.warn({ chatId, messageType: last?.type, contentTypes: getContentTypes(content) }, "Model returned no text")
                throw new Error("The model returned an empty answer")
            }

            const reply = await ctx.reply(answer)
            history.addMessage({
                id: reply.message_id,
                senderId: String(ctx.me.id),
                senderName: ctx.me.first_name,
                text: answer,
                timestamp: reply.date
            })
        } catch (error) {
            log.error({ err: error, chatId }, "Failed to answer Telegram group message")
        }

        return
    }

    if (ctx.chat.type !== "private") {
        return
    }

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
})
