import { ChatPlatform } from "../chat/platform.js"
import type { MessageEntity } from "grammy/types"
import type { OutgoingMessage } from "../messaging/message.js"

export function toTelegramResponse(message: OutgoingMessage) {
	const replyToMessageId = message.replyToMessageId
	const telegramReplyId = replyToMessageId === undefined ? undefined : Number(replyToMessageId)
	const hasCanonicalReplyId = replyToMessageId === undefined || /^[1-9]\d*$/.test(replyToMessageId)
	const hasSafeReplyId = telegramReplyId === undefined || Number.isSafeInteger(telegramReplyId)

	if (!hasCanonicalReplyId || !hasSafeReplyId) {
		throw new Error("Invalid Telegram reply message ID")
	}

	const entities: MessageEntity[] = []
	let text = ""

	for (const mention of message.mentions ?? []) {
		const hasTelegramPlatform = mention.userId.platform === ChatPlatform.Telegram
		const hasValidId = /^[1-9]\d*$/.test(mention.userId.value) && Number.isSafeInteger(Number(mention.userId.value))

		if (!hasTelegramPlatform || !hasValidId) {
			throw new Error("The model selected an unknown group user")
		}

		entities.push({
			type: "text_link",
			offset: text.length,
			length: mention.userId.name.length,
			url: `tg://user?id=${mention.userId.value}`
		})
		text += `${mention.userId.name} `
	}

	return {
		text: text + message.text,
		media: message.media,
		entities: message.mentions === undefined ? undefined : entities,
		mentions: (message.mentions ?? []).map((mention) => ({ userId: mention.userId, text: mention.userId.name })),
		replyToMessageId: telegramReplyId
	}
}
