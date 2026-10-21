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
import { createGroupMessage } from "./group-message.js"
import { compileGroupTriggers, matchesGroupTrigger, mentionsBot } from "../chat/group-triggers.js"
import { rootDir } from "../env.js"
import { getTelegramAttachments } from "./attachment.js"
import { sendTelegramResponse } from "./response.js"

const groupTriggers = compileGroupTriggers(await readFile(path.join(rootDir, "group-triggers.txt"), "utf8"))
const agent = await createGroupChatAgent()

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
                log.trace({ sent, chatId }, "Sent assistant message")
                await history.addAssistantMessage(ctx, {
                    message: sent.message,
                    text: sent.text,
                    mentions: sent.isText ? answer.mentions : []
                }, sent.isText ? undefined : sent.text)
            }
        }
    } catch (error) {
        log.error({ err: error, chatId }, "Failed to answer Telegram group message")
    }
}
