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
import { readFile } from "node:fs/promises"
import path from "node:path"
import { createGroupChatAgent } from "../agent/agent.js"
import { prepareGroupReplies } from "./group-response.js"
import { log } from "../logging.js"
import { PinoLangChainHandler } from "../agent/logging.js"
import { getGroupChatHistory } from "../chat/group.js"
import { compileGroupTriggers, matchesGroupTrigger, mentionsBot } from "../chat/group-triggers.js"
import { rootDir } from "../env.js"

const groupTriggers = compileGroupTriggers(await readFile(path.join(rootDir, "group-triggers.txt"), "utf8"))
const agent = await createGroupChatAgent()

export async function handleGroupMessage(ctx: Filter<Context, "message">): Promise<void> {
    const chatId = ctx.chat.id
    const history = getGroupChatHistory(`telegram:${chatId}`)
    const sender = ctx.from
    const senderChat = ctx.message.sender_chat
    const messageText = ctx.message.text ?? ctx.message.caption
    const mentionEntities = ctx.message.text ? ctx.message.entities : ctx.message.caption_entities

    history.addMessage({
        id: ctx.message.message_id,
        role: "user",
        senderId: senderChat ? String(senderChat.id) : String(sender?.id ?? "unknown"),
        senderName: senderChat?.title ?? (sender ? [sender.first_name, sender.last_name].filter(Boolean).join(" ") : "Desconocido"),
        text: messageText ?? "[mensaje sin texto]",
        timestamp: ctx.message.date,
        replyToMessageId: ctx.message.reply_to_message?.message_id,
        mentions: (mentionEntities ?? [])
            .filter(entity => entity.type === "mention" || entity.type === "text_mention")
            .map(entity => ({
                text: (messageText ?? "").slice(entity.offset, entity.offset + entity.length),
                userId: entity.type === "text_mention" ? String(entity.user.id) : null
            }))
    })

    const triggeredByPattern = messageText ? matchesGroupTrigger(messageText, groupTriggers) : false
    const triggeredByMention = messageText
        ? mentionsBot(messageText, mentionEntities ?? [], ctx.me.id, ctx.me.username)
        : false

    if (!triggeredByPattern && !triggeredByMention) {
        return
    }

    try {
        const historySnapshot = history.messages
        const messages = history.toModelMessages(ctx.message.message_id)
        const result = await agent.invoke({ messages }, { callbacks: [new PinoLangChainHandler(chatId)] })
        const answers = prepareGroupReplies(result.structuredResponse, historySnapshot)

        for (const answer of answers) {
            const reply = await ctx.reply(answer.text, {
                entities: answer.entities,
                reply_parameters: answer.replyToMessageId === undefined
                    ? undefined
                    : { message_id: answer.replyToMessageId, allow_sending_without_reply: true }
            })
            history.addMessage({
                id: reply.message_id,
                role: "assistant",
                senderId: String(ctx.me.id),
                senderName: ctx.me.first_name,
                text: answer.text,
                timestamp: reply.date,
                replyToMessageId: reply.reply_to_message?.message_id,
                mentions: answer.mentions
            })
        }
    } catch (error) {
        log.error({ err: error, chatId }, "Failed to answer Telegram group message")
    }
}
