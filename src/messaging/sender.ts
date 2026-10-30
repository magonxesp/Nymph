import type { ChatId } from "../chat/id.js"
import type { OutgoingMessage, SentMessage } from "./message.js"

export interface MessageSender {
	readonly chatId: ChatId
	send(message: OutgoingMessage): AsyncIterable<SentMessage>
}
