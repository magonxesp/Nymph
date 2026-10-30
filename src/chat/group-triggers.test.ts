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
import { compileGroupTriggers, matchesGroupTrigger } from "./group-triggers.js"

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
