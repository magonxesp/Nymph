/**
 * Nymph
 * Copyright (C) 2026  MagonxESP
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, expect, it } from "vitest"
import { compileGroupTriggers, matchesGroupTrigger, mentionsBot } from "./group-triggers.js"

describe("group triggers", () => {
	it("supports glob wildcards and ignores comments", () => {
		const triggers = compileGroupTriggers("# Comment\n*nymph*\nhey ?ymph\n")

		expect(triggers).toHaveLength(2)
		expect(matchesGroupTrigger("Oye, NYMPH, ¿qué opinas?", triggers)).toBe(true)
		expect(matchesGroupTrigger("hey nymph", triggers)).toBe(true)
		expect(matchesGroupTrigger("Hablemos de otra cosa", triggers)).toBe(false)
	})

	it("treats regex punctuation as literal text", () => {
		const triggers = compileGroupTriggers("@nymph.bot")

		expect(matchesGroupTrigger("@nymph.bot", triggers)).toBe(true)
		expect(matchesGroupTrigger("@nymphXbot", triggers)).toBe(false)
	})
})

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
