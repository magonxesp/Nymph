import { describe, expect, it } from "vitest"
import { ChatId } from "./id.js"
import { ChatPlatform } from "./platform.js"

describe("ChatId", () => {
	it("keeps the platform separate from the native chat ID", () => {
		const chatId = new ChatId("123", ChatPlatform.Telegram)

		expect(chatId.value).toBe("123")
		expect(chatId.platform).toBe(ChatPlatform.Telegram)
		expect(chatId.toMapKey()).toBe("telegram:123")
	})

	it.each(["123", "-100123", "9007199254740993", "room:general"])("preserves the native string ID %s", (value) => {
		const chatId = new ChatId(value, ChatPlatform.Telegram)

		expect(chatId.value).toBe(value)
	})

	it.each(["", " "])("rejects a blank chat ID: %j", (value) => {
		expect(() => new ChatId(value, ChatPlatform.Telegram)).toThrow("The chat ID must not be blank")
	})
})
