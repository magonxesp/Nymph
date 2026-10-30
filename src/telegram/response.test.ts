import { Api, Context } from "grammy"
import type { Update, UserFromGetMe } from "grammy/types"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sendTelegramResponse } from "./response.js"
import { TelegramMessageSender } from "./message-sender.js"
import { privateResponseSchema } from "../chat/response.js"

afterEach(() => {
	vi.restoreAllMocks()
})

const update: Update = {
	update_id: 1,
	message: {
		message_id: 1,
		date: 123,
		from: { id: 1, is_bot: false, first_name: "Ana" },
		chat: { id: 9100, type: "private", first_name: "Ana" },
		text: "Hola"
	}
}

const botInfo: UserFromGetMe = {
	id: 99,
	is_bot: true,
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

describe("sendTelegramResponse", () => {
	it.each(["photo", "animation", "video"] as const)("sends %s without requiring text", async (type) => {
		const ctx = new Context(update, new Api("test-token"), botInfo)
		const sentMessage = {
			message_id: 2,
			date: 124,
			chat: { id: 9100, type: "private" as const, first_name: "Ana" },
			text: "media"
		}
		const photo = vi.spyOn(ctx, "replyWithPhoto").mockResolvedValue({ ...sentMessage, photo: [] })
		const animation = vi.spyOn(ctx, "replyWithAnimation").mockResolvedValue({
			...sentMessage,
			document: {
				file_id: "animation",
				file_unique_id: "animation"
			},
			animation: {
				file_id: "animation",
				file_unique_id: "animation",
				width: 1,
				height: 1,
				duration: 1
			}
		})
		const video = vi.spyOn(ctx, "replyWithVideo").mockResolvedValue({
			...sentMessage,
			video: {
				file_id: "video",
				file_unique_id: "video",
				width: 1,
				height: 1,
				duration: 1
			}
		})
		const text = vi.spyOn(ctx, "reply")
		const results = []

		for await (const sent of sendTelegramResponse(ctx, {
			text: "",
			media: [{ url: "https://example.com/media", type }],
			replyToMessageId: 1
		})) {
			results.push(sent)
		}

		const selectedMethod = { photo, animation, video }[type]
		expect(selectedMethod).toHaveBeenCalledWith("https://example.com/media", {
			reply_parameters: {
				message_id: 1,
				allow_sending_without_reply: true
			}
		})
		expect(photo.mock.calls.length + animation.mock.calls.length + video.mock.calls.length).toBe(1)
		expect(text).not.toHaveBeenCalled()
		expect(results).toEqual([
			{
				message: expect.any(Object),
				text: "https://example.com/media",
				isText: false
			}
		])
	})

	it("sends the original URL if Telegram cannot fetch the media", async () => {
		const ctx = new Context(update, new Api("test-token"), botInfo)
		vi.spyOn(ctx, "replyWithPhoto").mockRejectedValue(new Error("Telegram rejected the photo"))
		const reply = vi.spyOn(ctx, "reply").mockResolvedValue({
			message_id: 2,
			date: 124,
			chat: { id: 9100, type: "private", first_name: "Ana" },
			text: "https://example.com/image.jpg"
		})
		const results = []

		for await (const sent of sendTelegramResponse(ctx, {
			text: "",
			media: [{ url: "https://example.com/image.jpg", type: "photo" }]
		})) {
			results.push(sent)
		}

		expect(reply).toHaveBeenCalledWith("https://example.com/image.jpg", {
			reply_parameters: undefined
		})
		expect(results[0].text).toBe("https://example.com/image.jpg")
	})

	it("preserves forum topics, business connections and explicit replies for conversations", async () => {
		const chat = { id: -9100, type: "supergroup" as const, title: "Grupo" }
		const request = vi.fn<typeof fetch>()
		request
			.mockResolvedValueOnce(
				Response.json({
					ok: true,
					result: { message_id: 2, date: 124, chat, text: "Respuesta" }
				})
			)
			.mockResolvedValueOnce(
				Response.json({
					ok: true,
					result: { message_id: 3, date: 125, chat, photo: [] }
				})
			)
		const api = new Api("test-token", { fetch: request })
		const ctx = new Context(
			{
				update_id: 1,
				message: {
					message_id: 1,
					date: 123,
					chat,
					text: "Hola",
					from: { id: 1, is_bot: false, first_name: "Ana" },
					is_topic_message: true,
					message_thread_id: 22,
					business_connection_id: "business"
				}
			},
			api,
			botInfo
		)

		for await (const sent of TelegramMessageSender.fromContext(ctx).send({
			text: "Respuesta",
			media: [{ type: "photo", url: "https://example.com/image.jpg" }],
			replyToMessageId: "1"
		})) {
			expect(sent.message.senderId).toBe("99")
		}

		expect(request).toHaveBeenCalledTimes(2)

		for (const [, options] of request.mock.calls) {
			if (typeof options?.body !== "string") {
				throw new Error("Expected a JSON Telegram request body")
			}

			const payload: unknown = JSON.parse(options.body)
			expect(payload).toMatchObject({
				chat_id: -9100,
				message_thread_id: 22,
				business_connection_id: "business",
				reply_parameters: { message_id: 1, allow_sending_without_reply: true }
			})
		}
	})
})

describe("privateResponseSchema", () => {
	it.each(["data:image/png;base64,AQID", "file:///tmp/image.png", "not a URL", "https://"])(
		"rejects invalid media URL %s",
		(url) => {
			expect(() =>
				privateResponseSchema.parse({
					text: "",
					media: [{ url, type: "photo" }]
				})
			).toThrow()
		}
	)

	it("requires structured media even for text-only answers", () => {
		expect(() => privateResponseSchema.parse({ text: "Hola" })).toThrow()
		expect(privateResponseSchema.parse({ text: "Hola", media: [] })).toEqual({
			text: "Hola",
			media: []
		})
	})
})
