import { describe, expect, it } from "vitest"
import { mentionsBot } from "./group-triggers.js"

describe("bot mentions", () => {
	it("recognizes the bot username in a Telegram mention entity", () => {
		const text = "Hola @NymphBot, ¿qué opinas?"
		const entities = [{ type: "mention", offset: 5, length: 9 }]

		expect(mentionsBot(text, entities, 42, "nymphbot")).toBe(true)
		expect(mentionsBot(text, entities, 42, "otherbot")).toBe(false)
	})

	it("recognizes a text mention addressed to the bot", () => {
		const text = "Hola Nymph"
		const entities = [{ type: "text_mention", offset: 5, length: 5, user: { id: 42 } }]

		expect(mentionsBot(text, entities, 42)).toBe(true)
		expect(mentionsBot(text, entities, 7)).toBe(false)
	})

	it("does not infer a mention from ordinary text", () => {
		expect(mentionsBot("Hola @NymphBot", [], 42, "NymphBot")).toBe(false)
	})
})
