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
import { createPrivateChatAgent } from "../agent/agent.js"
import { log } from "../logging.js"
import { PinoLangChainHandler } from "../agent/logging.js"
import { getPrivateChatHistory } from "../chat/chat.js"
import { toModelMessage } from "../chat/message.js"
import { getTelegramAttachments } from "./attachment.js"
import { privateResponseSchema } from "../chat/response.js"
import { TelegramMessageSender } from "./message-sender.js"

const agent = await createPrivateChatAgent()

export async function handlePrivateMessage(
	ctx: Filter<Context, "message">,
	pendingMessages: Filter<Context, "message">[] = [ctx]
): Promise<void> {
	const chatId = ctx.chat.id
	const history = getPrivateChatHistory(new ChatId(String(chatId), ChatPlatform.Telegram))

	try {
		let addedMessages = false

		for (const messageContext of pendingMessages) {
			const text = messageContext.message.text ?? messageContext.message.caption
			const attachments = await getTelegramAttachments(messageContext.message, messageContext.api)

			if (attachments === null) {
				continue
			}

			const { images, files } = attachments

			if (!text && images.length === 0 && files.length === 0) {
				continue
			}

			const placeholder = images.length ? "[imagen sin texto]" : "[archivo sin texto]"
			history.addUserMessage(text ?? placeholder, images, files)
			addedMessages = true
		}

		if (!addedMessages) {
			return
		}

		const historySnapshot = history.messages
		const messages = historySnapshot.map(toModelMessage)
		const result = await agent.invoke(
			{ messages },
			{
				callbacks: [new PinoLangChainHandler(chatId)],
				configurable: {
					requesterId: ctx.message.from?.id === undefined ? undefined : toUserId(ctx.message.from),
					chat: {
						id: history.chatId.value,
						platform: history.chatId.platform,
						type: "private"
					}
				}
			}
		)
		const answer = privateResponseSchema.parse(result.structuredResponse)

		if (!answer.text.trim() && answer.media.length === 0) {
			throw new Error("The model returned an empty answer")
		}

		for await (const sent of TelegramMessageSender.fromContext(ctx).send(answer)) {
			log.trace({ sent, chatId }, "Sent assistant message")
			await history.addAssistantMessage(sent.message.text, sent.isText ? undefined : sent.message.text)
		}
	} catch (error) {
		log.error({ err: error, chatId }, "Failed to answer Telegram message")
		await ctx.reply("No he podido responder ahora. Inténtalo de nuevo en un momento.")
	}
}
