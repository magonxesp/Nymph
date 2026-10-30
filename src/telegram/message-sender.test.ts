import { UserId } from "../chat/user-id.js"
import { Api } from "grammy"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ChatId } from "../chat/id.js"
import { ChatPlatform } from "../chat/platform.js"
import { TelegramMessageSender } from "./message-sender.js"

const botInfo = {
	id: 99,
	is_bot: true as const,
	first_name: "Nymph",
	username: "nymph_bot",
	can_join_groups: true,
	can_read_all_group_messages: true,
	supports_inline_queries: false,
	can_connect_to_business: false,
	has_main_web_app: false,
	has_topics_enabled: false,
	allows_users_to_create_topics: false,
	can_manage_bots: false,
	supports_join_request_queries: false
}
const chat = { id: -123, type: "group" as const, title: "Grupo" }
const api = new Api("test-token")
const chatId = new ChatId(String(chat.id), ChatPlatform.Telegram)

beforeEach(() => {
	vi.restoreAllMocks()
	vi.spyOn(api, "getMe").mockResolvedValue(botInfo)
})

describe("Telegram message sender", () => {
	it("adapts generic replies and mentions and returns domain messages", async () => {
		const send = vi.spyOn(api, "sendMessage").mockResolvedValue({
			message_id: 11,
			date: 123,
			chat,
			text: "Ana 🦋 Hola",
			reply_to_message: { message_id: 10, date: 122, chat, reply_to_message: undefined }
		})
		const sender = new TelegramMessageSender(chatId, api)
		const sent = []

		for await (const result of sender.send({
			text: "Hola",
			media: [],
			replyToMessageId: "10",
			mentions: [{ text: "Ana 🦋", userId: new UserId("1", "Ana 🦋", ChatPlatform.Telegram) }]
		})) {
			sent.push(result)
		}

		expect(send).toHaveBeenCalledWith("-123", "Ana 🦋 Hola", {
			entities: [{ type: "text_link", offset: 0, length: 6, url: "tg://user?id=1" }],
			reply_parameters: { message_id: 10, allow_sending_without_reply: true }
		})
		expect(sent).toEqual([
			{
				isText: true,
				message: {
					id: "11",
					role: "assistant",
					senderId: "99",
					senderName: "Nymph",
					text: "Ana 🦋 Hola",
					timestamp: 123,
					replyToMessageId: "10",
					mentions: [{ text: "Ana 🦋", userId: new UserId("1", "Ana 🦋", ChatPlatform.Telegram) }]
				}
			}
		])
	})

	it.each(["photo", "animation", "video"] as const)("sends %s and falls back to the original URL", async (type) => {
		const photo = vi.spyOn(api, "sendPhoto").mockRejectedValue(new Error("Media unavailable"))
		const animation = vi.spyOn(api, "sendAnimation").mockRejectedValue(new Error("Media unavailable"))
		const video = vi.spyOn(api, "sendVideo").mockRejectedValue(new Error("Media unavailable"))
		const send = vi
			.spyOn(api, "sendMessage")
			.mockResolvedValue({ message_id: 12, date: 124, chat, text: "https://example.com/media" })
		const sender = new TelegramMessageSender(chatId, api)
		const sent = []

		for await (const result of sender.send({
			text: "",
			media: [{ type, url: "https://example.com/media" }],
			replyToMessageId: "10"
		})) {
			sent.push(result)
		}

		const options = { reply_parameters: { message_id: 10, allow_sending_without_reply: true } }
		expect({ photo, animation, video }[type]).toHaveBeenCalledWith("-123", "https://example.com/media", options)
		expect(send).toHaveBeenCalledWith("-123", "https://example.com/media", options)
		expect(sent[0]).toMatchObject({ isText: false, message: { id: "12", text: "https://example.com/media" } })
	})

	it("does not hide a text delivery failure", async () => {
		vi.spyOn(api, "sendMessage").mockRejectedValue(new Error("Telegram unavailable"))
		const sender = new TelegramMessageSender(chatId, api)

		await expect(sender.send({ text: "Hola", media: [] }).next()).rejects.toThrow("Telegram unavailable")
	})

	it("rejects unsupported Telegram IDs before making API calls", async () => {
		const sender = new TelegramMessageSender(chatId, api)
		const send = vi.spyOn(api, "sendMessage")

		await expect(
			sender.send({ text: "Hola", media: [], replyToMessageId: "message:alpha" }).next()
		).rejects.toThrow("Invalid Telegram reply message ID")
		expect(api.getMe).not.toHaveBeenCalled()
		expect(send).not.toHaveBeenCalled()
	})
})
