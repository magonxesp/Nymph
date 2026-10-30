import { UserId } from "./user-id.js"
import type { ChatPlatform } from "./platform.js"
import { groupResponseSchema } from "./group.js"
import type { GroupMessage } from "./group.js"
import type { OutgoingMessage } from "../messaging/message.js"

export function prepareGroupReplies(
	value: unknown,
	history: GroupMessage[],
	platform: ChatPlatform
): OutgoingMessage[] {
	const response = groupResponseSchema.parse(value)

	return response.messages.map((message) => {
		if (!message.text.trim() && message.media.length === 0) {
			throw new Error("The model returned an empty group answer")
		}

		const replyToMessageId = message.replyToMessageId
		const hasUnknownReply = replyToMessageId !== null && !history.some((entry) => entry.id === replyToMessageId)

		if (hasUnknownReply) {
			throw new Error("The model selected a message outside the group history")
		}

		const mentions = [...new Set(message.mentionUserIds)].map((userId) => {
			const participant = history.findLast((entry) => entry.senderId === userId)

			if (!participant) {
				throw new Error("The model selected an unknown group user")
			}

			const name = participant.senderName.trim() || userId

			return { userId: new UserId(userId, name, platform), text: name }
		})

		return { text: message.text, media: message.media, mentions, replyToMessageId: replyToMessageId ?? undefined }
	})
}
