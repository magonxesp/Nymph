import { describe, expect, it } from "vitest"
import { ChatPlatform } from "../chat/platform.js"
import { UserId } from "../chat/user-id.js"
import { toTelegramResponse } from "./outgoing-message.js"

describe("Telegram outgoing mentions", () => {
	it("uses the identity name, ID and UTF-16 offsets for clickable mentions", () => {
		const response = toTelegramResponse({
			text: "Hola",
			media: [],
			mentions: [
				{ userId: new UserId("1", "Ana García 🦋", ChatPlatform.Telegram), text: "Ana" },
				{ userId: new UserId("2", "Luis", ChatPlatform.Telegram), text: "Luis" }
			]
		})

		expect(response.text).toBe("Ana García 🦋 Luis Hola")
		expect(response.entities).toEqual([
			{ type: "text_link", offset: 0, length: 13, url: "tg://user?id=1" },
			{ type: "text_link", offset: 14, length: 4, url: "tg://user?id=2" }
		])
	})

	it.each(["user:ana", "-1", "01", "9007199254740993"])("rejects unsupported Telegram IDs (%s)", (id) => {
		expect(() =>
			toTelegramResponse({
				text: "Hola",
				media: [],
				mentions: [{ userId: new UserId(id, "Ana", ChatPlatform.Telegram), text: "Ana" }]
			})
		).toThrow("unknown group user")
	})
})
