import { ChatPlatform } from "../chat/platform.js"
import { UserId } from "../chat/user-id.js"
import { describe, expect, it } from "vitest"
import type { GroupMessageContext } from "./group-message.js"
import { createGroupMessage } from "./group-message.js"

const context: GroupMessageContext = {
	me: { id: 99, first_name: "Nymph" },
	message: {
		message_id: 5,
		date: 123,
		chat: { id: -1, type: "group", title: "Grupo" },
		from: { id: 1, is_bot: false, first_name: "Ana", last_name: "García" },
		caption: "🦋 Hola Nymph @alias",
		caption_entities: [
			{ type: "text_mention", offset: 8, length: 5, user: { id: 99, is_bot: true, first_name: "Nymph" } },
			{ type: "mention", offset: 14, length: 6 }
		],
		reply_to_message: {
			message_id: 4,
			reply_to_message: undefined,
			date: 122,
			chat: { id: -1, type: "group", title: "Grupo" },
			text: "Hola"
		}
	}
}

describe("Telegram group message adapter", () => {
	it("normalizes IDs, sender, caption mentions and reply metadata", () => {
		expect(createGroupMessage(context, "user")).toEqual({
			id: "5",
			role: "user",
			senderId: "1",
			senderName: "Ana García",
			text: "🦋 Hola Nymph @alias",
			timestamp: 123,
			replyToMessageId: "4",
			mentions: [
				{ text: "Nymph", userId: new UserId("99", "Nymph", ChatPlatform.Telegram) },
				{ text: "@alias", userId: null }
			]
		})
	})

	it("preserves anonymous sender chats instead of attributing them to a user", () => {
		const message = createGroupMessage(
			{
				...context,
				message: { ...context.message, sender_chat: { id: -100123, type: "channel", title: "Canal" } }
			},
			"user"
		)

		expect(message.senderId).toBe("-100123")
		expect(message.senderName).toBe("Canal")
	})

	it("normalizes the sent message and bot identity for assistant history", () => {
		const message = createGroupMessage(context, "assistant", {
			message: { message_id: 6, date: 124, chat: context.message.chat },
			text: "Ana, aquí está",
			mentions: [{ text: "Ana", userId: new UserId("1", "Ana", ChatPlatform.Telegram) }],
			images: ["data:image/png;base64,AQID"]
		})

		expect(message).toEqual({
			id: "6",
			role: "assistant",
			senderId: "99",
			senderName: "Nymph",
			text: "Ana, aquí está",
			timestamp: 124,
			mentions: [{ text: "Ana", userId: new UserId("1", "Ana", ChatPlatform.Telegram) }],
			images: ["data:image/png;base64,AQID"]
		})
	})
})
