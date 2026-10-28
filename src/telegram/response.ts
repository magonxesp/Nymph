import type { Api, Context } from "grammy"
import type { Message, MessageEntity } from "grammy/types"
import type { ResponseMedia } from "../chat/response.js"
import { log } from "../logging.js"
import type { TelegramSender, TelegramSendOptions } from "./sender.js"
import { TelegramContextSender } from "./sender/context.js"
import { TelegramChatSender } from "./sender/chat.js"

type TelegramResponse = {
	text: string
	media: ResponseMedia[]
	entities?: MessageEntity[]
	replyToMessageId?: number
}

export function sendTelegramResponse(ctx: Context, response: TelegramResponse) {
	return sendResponse(new TelegramContextSender(ctx), response)
}

export function sendTelegramResponseToChat(api: Api, chatId: string | number, response: TelegramResponse) {
	return sendResponse(new TelegramChatSender(api, chatId), response)
}

async function* sendResponse(sender: TelegramSender, response: TelegramResponse) {
	const replyOptions = ((): TelegramSendOptions => {
		if (response.replyToMessageId === undefined) {
			return { reply_parameters: undefined }
		}

		return {
			reply_parameters: {
				message_id: response.replyToMessageId,
				allow_sending_without_reply: true
			}
		}
	})()

	if (response.text.trim()) {
		const message = await ((): Promise<Message> => {
			const hasOptions = response.entities !== undefined || response.replyToMessageId !== undefined

			if (hasOptions) {
				return sender.sendMessage(response.text, {
					...replyOptions,
					entities: response.entities
				})
			}

			return sender.sendMessage(response.text)
		})()

		yield { message, text: response.text, isText: true }
	}

	for (const media of response.media) {
		let message

		try {
			switch (media.type) {
				case "photo":
					message = await sender.sendPhoto(media.url, replyOptions)
					break
				case "animation":
					message = await sender.sendAnimation(media.url, replyOptions)
					break
				case "video":
					message = await sender.sendVideo(media.url, replyOptions)
					break
			}
		} catch (error) {
			log.warn({ err: error, chatId: sender.chatId }, "Failed to send Telegram media; sending original URL")
			message = await sender.sendMessage(media.url, replyOptions)
		}

		yield { message, text: media.url, isText: false }
	}
}
