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

import type { Context, Filter } from 'grammy'
import { createPrivateChatAgent } from '../agent/agent.js'
import { log } from '../logging.js'
import { PinoLangChainHandler } from '../agent/logging.js'
import { getPrivateChatHistory } from '../chat/chat.js'
import { toModelMessage } from '../chat/message.js'
import { getTelegramAttachments } from './attachment.js'
import { privateResponseSchema } from '../chat/response.js'
import { sendTelegramResponse } from './response.js'

const agent = await createPrivateChatAgent()

export async function handlePrivateMessage(ctx: Filter<Context, 'message'>): Promise<void> {
	const chatId = ctx.chat.id

	const text = ctx.message.text ?? ctx.message.caption
	const history = getPrivateChatHistory(`telegram:${chatId}`)

	try {
		const attachments = await getTelegramAttachments(ctx.message, ctx.api)

		if (attachments === null) {
			return
		}

		const { images, files } = attachments
		if (!text && images.length === 0 && files.length === 0) {
			return
		}

		const placeholder = images.length ? '[imagen sin texto]' : '[archivo sin texto]'
		history.addUserMessage(text ?? placeholder, images, files)
		const historySnapshot = history.messages
		const messages = historySnapshot.map(toModelMessage)
		const result = await agent.invoke(
			{ messages },
			{
				callbacks: [new PinoLangChainHandler(chatId)],
				configurable: {
					chat: {
						id: history.chatId.value,
						type: 'private'
					}
				}
			}
		)
		const answer = privateResponseSchema.parse(result.structuredResponse)

		if (!answer.text.trim() && answer.media.length === 0) {
			throw new Error('The model returned an empty answer')
		}

		for await (const sent of sendTelegramResponse(ctx, answer)) {
			log.trace({ sent, chatId }, 'Sent assistant message')
			await history.addAssistantMessage(sent.text, sent.isText ? undefined : sent.text)
		}
	} catch (error) {
		log.error({ err: error, chatId }, 'Failed to answer Telegram message')
		await ctx.reply('No he podido responder ahora. Inténtalo de nuevo en un momento.')
	}
}
