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
import { ChatId } from "../chat/id.js"
import { MemoryContent } from "./content.js"
import { Embedding } from "./embedding.js"
import { MemoryId } from "./id.js"

describe("Memory value objects", () => {
	it("validates the chat ID value", () => {
		expect(new ChatId("telegram:123").value).toBe("telegram:123")
		expect(() => new ChatId(" ")).toThrow()
	})

	it("preserves bigint IDs as strings", () => {
		expect(new MemoryId("9007199254740993").value).toBe("9007199254740993")
		expect(() => new MemoryId("0")).toThrow()
		expect(() => new MemoryId("-1")).toThrow()
	})

	it("requires nonblank memory content", () => {
		expect(new MemoryContent("Nymph usa TypeScript").value).toBe("Nymph usa TypeScript")
		expect(() => new MemoryContent(" ")).toThrow()
	})

	it("requires a finite nonzero embedding and protects its values", () => {
		const values = [1, 0, 0]
		const embedding = new Embedding(values)
		values[0] = 0

		expect(embedding.value).toEqual([1, 0, 0])
		expect(Object.isFrozen(embedding.value)).toBe(true)
		expect(() => new Embedding([])).toThrow()
		expect(() => new Embedding([0, 0])).toThrow()
		expect(() => new Embedding([NaN])).toThrow()
		expect(() => new Embedding([Infinity])).toThrow()
	})
})
