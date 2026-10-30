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

import { ChatPlatform } from "../chat/platform.js"
import { toUserId } from "./user-id.js"
import { ChatId } from "../chat/id.js"
import type { Context, Filter } from "grammy"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { createGroupChatAgent } from "../agent/agent.js"
import { prepareGroupReplies } from "../chat/group-response.js"
import { log } from "../logging.js"
import { PinoLangChainHandler } from "../agent/logging.js"
import { getGroupChatHistory } from "../chat/group.js"
import { mentionsBot } from "./group-triggers.js"
import { createGroupMessage } from "./group-message.js"
import { compileGroupTriggers, matchesGroupTrigger } from "../chat/group-triggers.js"
import { rootDir } from "../env.js"
import { getTelegramAttachments } from "./attachment.js"
import { TelegramMessageSender } from "./message-sender.js"

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
	const history = getGroupChatHistory(new ChatId(String(chatId), ChatPlatform.Telegram))

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
		const messages = history.toModelMessages(String(ctx.message.message_id))
		const result = await agent.invoke(
			{ messages },
			{
				callbacks: [new PinoLangChainHandler(chatId)],
				configurable: {
					requesterId:
						ctx.message.sender_chat || ctx.message.from?.id === undefined
							? undefined
							: toUserId(ctx.message.from),
					chat: {
						id: history.chatId.value,
						platform: history.chatId.platform,
						type: "group"
					}
				}
			}
		)
		const answers = prepareGroupReplies(result.structuredResponse, historySnapshot, history.chatId.platform)
		const sender = TelegramMessageSender.fromContext(ctx)

		for (const answer of answers) {
			for await (const sent of sender.send(answer)) {
				log.trace({ sent, chatId }, "Sent assistant message")
				await history.addAssistantMessage(sent.message, sent.isText ? undefined : sent.message.text)
			}
		}
	} catch (error) {
		log.error({ err: error, chatId }, "Failed to answer Telegram group message")
	}
}
