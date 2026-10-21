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
import type { Message } from "grammy/types"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { createGroupChatAgent } from "../agent/agent.js"
import { prepareGroupReplies } from "./group-response.js"
import { log } from "../logging.js"
import { PinoLangChainHandler } from "../agent/logging.js"
import { getGroupChatHistory } from "../chat/group.js"
import type { GroupMessage } from "../chat/group.js"
import { compileGroupTriggers, matchesGroupTrigger, mentionsBot } from "../chat/group-triggers.js"
import { rootDir } from "../env.js"
import { getTelegramAttachments } from "./attachment.js"
import { sendTelegramResponse } from "./response.js"

const groupTriggers = compileGroupTriggers(await readFile(path.join(rootDir, "group-triggers.txt"), "utf8"))
const agent = await createGroupChatAgent()

type GroupMessageOptions = Partial<Pick<GroupMessage, "text" | "images" | "files" | "mentions">> & {
    message?: Message
}

function createGroupMessage(
    ctx: Filter<Context, "message">,
    role: GroupMessage["role"],
    options: GroupMessageOptions = {}
): GroupMessage {
    const message = options.message ?? ctx.message
    const sender = role === "assistant" ? ctx.me : message.from
    const senderChat = role === "user" ? message.sender_chat : undefined
    const text = options.text ?? message.text ?? message.caption
    const mentionEntities = message.text ? message.entities : message.caption_entities
    const { images, files } = options

    const mapSenderId = (): string => {
        if (senderChat) {
            return String(senderChat.id)
        }

        return String(sender?.id ?? "unknown")
    }

    const mapSenderName = (): string => {
        if (role === "assistant") {
            return ctx.me.first_name
        }

        if (senderChat?.title !== undefined) {
            return senderChat.title
        }

        if (sender) {
            return [sender.first_name, sender.last_name].filter(Boolean).join(" ")
        }

        return "Desconocido"
    }

    const mapText = (): string => {
        if (text !== undefined) {
            return text
        }

        if (images?.length) {
            return "[imagen sin texto]"
        }

        if (files?.length) {
            return "[archivo sin texto]"
        }

        return "[mensaje sin texto]"
    }

    const mapMentions = (): GroupMessage["mentions"] => {
        return options.mentions ?? (mentionEntities ?? [])
            .filter(entity => entity.type === "mention" || entity.type === "text_mention")
            .map(entity => ({
                text: (text ?? "").slice(entity.offset, entity.offset + entity.length),
                userId: entity.type === "text_mention" ? String(entity.user.id) : null
            }))
    }

    return {
        id: message.message_id,
        role,
        senderId: mapSenderId(),
        senderName: mapSenderName(),
        text: mapText(),
        images,
        files,
        timestamp: message.date,
        replyToMessageId: message.reply_to_message?.message_id,
        mentions: mapMentions()
    }
}

function isGroupTriggered(ctx: Filter<Context, "message">): boolean {
    const triggeredByReply = ctx.message.reply_to_message?.from?.id === ctx.me.id

    if (triggeredByReply) {
        return true
    }

    const messageText = ctx.message.text ?? ctx.message.caption

    if (!messageText) {
        return false
    }

    const mentionEntities = ctx.message.text ? ctx.message.entities : ctx.message.caption_entities
    const triggeredByPattern = matchesGroupTrigger(messageText, groupTriggers)
    const triggeredByMention = mentionsBot(messageText, mentionEntities ?? [], ctx.me.id, ctx.me.username)

    return triggeredByPattern || triggeredByMention
}

export async function handleGroupMessage(ctx: Filter<Context, "message">): Promise<void> {
    const chatId = ctx.chat.id
    const history = getGroupChatHistory(`telegram:${chatId}`)

    try {
        const attachments = await getTelegramAttachments(ctx.message, ctx.api)

        if (attachments === null) {
            return
        }

        history.addMessage(createGroupMessage(ctx, "user", attachments))

        if (!isGroupTriggered(ctx)) {
            return
        }

        const historySnapshot = history.messages
        const messages = history.toModelMessages(ctx.message.message_id)
        const result = await agent.invoke({ messages }, { callbacks: [new PinoLangChainHandler(chatId)] })
        const answers = prepareGroupReplies(result.structuredResponse, historySnapshot)

        for (const answer of answers) {
            for await (const sent of sendTelegramResponse(ctx, answer)) {
                history.addMessage(createGroupMessage(ctx, "assistant", {
                    message: sent.message,
                    text: sent.text,
                    mentions: sent.isText ? answer.mentions : []
                }))
            }
        }
    } catch (error) {
        log.error({ err: error, chatId }, "Failed to answer Telegram group message")
    }
}
