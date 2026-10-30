import { Api } from "grammy"
import { describe, expect, it, vi } from "vitest"
import { ChatId } from "../chat/id.js"
import { ChatPlatform } from "../chat/platform.js"
import { TelegramMessageSender } from "../telegram/message-sender.js"
import { createMessageSender } from "./factory.js"

const api = new Api("test-token")
vi.mock("../telegram/api.js", () => ({ getTelegramApi: () => api }))

describe("message sender factory", () => {
	it("selects the Telegram implementation from the chat platform", () => {
		const chatId = new ChatId("123", ChatPlatform.Telegram)
		const sender = createMessageSender(chatId)

		expect(sender).toBeInstanceOf(TelegramMessageSender)
		expect(sender.chatId).toBe(chatId)
	})

	it("keeps destinations independent without sending during creation", () => {
		const send = vi.spyOn(api, "sendMessage")
		const first = createMessageSender(new ChatId("123", ChatPlatform.Telegram))
		const second = createMessageSender(new ChatId("456", ChatPlatform.Telegram))

		expect(first.chatId.value).toBe("123")
		expect(second.chatId.value).toBe("456")
		expect(send).not.toHaveBeenCalled()
		vi.restoreAllMocks()
	})
})
