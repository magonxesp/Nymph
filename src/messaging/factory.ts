import type { ChatId } from "../chat/id.js"
import { ChatPlatform } from "../chat/platform.js"
import { TelegramMessageSender } from "../telegram/message-sender.js"
import type { MessageSender } from "./sender.js"

export function createMessageSender(chatId: ChatId): MessageSender {
	switch (chatId.platform) {
		case ChatPlatform.Telegram:
			return new TelegramMessageSender(chatId)
		default:
			throw new Error(`Unsupported chat platform: ${chatId.platform}`)
	}
}
