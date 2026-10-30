import type { UserId } from "../chat/user-id.js"
import type { GroupMessage } from "../chat/group.js"
import type { ResponseMedia } from "../chat/response.js"

export type MessageMention = {
	userId: UserId
	text: string
}

export type OutgoingMessage = {
	text: string
	media: ResponseMedia[]
	mentions?: MessageMention[]
	replyToMessageId?: string
}

export type SentMessage = {
	message: GroupMessage
	isText: boolean
}
