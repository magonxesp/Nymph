import { describe, expect, it } from "vitest"
import { ChatPlatform } from "./platform.js"
import { getConfiguredChat } from "./configuration.js"
import type { ChatReference } from "./snapshot.js"

describe("internal chat configuration", () => {
	it("returns the chat reference supplied by the application", () => {
		const chat: ChatReference = { id: "room:general", platform: ChatPlatform.Telegram, type: "group" }

		expect(getConfiguredChat({ configurable: { chat } })).toBe(chat)
	})

	it("requires a chat reference", () => {
		expect(() => getConfiguredChat({})).toThrow("Chat configuration is required")
		expect(() => getConfiguredChat({ configurable: {} })).toThrow("Chat configuration is required")
	})
})
