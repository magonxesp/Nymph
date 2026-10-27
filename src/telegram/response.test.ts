import { Api, Context } from "grammy"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sendTelegramResponse } from "./response.js"
import { privateResponseSchema } from "../chat/response.js"

afterEach(() => {
	vi.restoreAllMocks()
})

function createContext() {
	return new Context(
		{
			update_id: 1,
			message: {
				message_id: 1,
				date: 123,
				from: { id: 1, is_bot: false, first_name: "Ana" },
				chat: { id: 9100, type: "private", first_name: "Ana" },
				text: "Hola"
			}
		},
		new Api("test-token"),
		{
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
	)
}

describe("sendTelegramResponse", () => {
	it.each(["photo", "animation", "video"] as const)("sends %s without requiring text", async (type) => {
		const ctx = createContext()
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
		const ctx = createContext()
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
