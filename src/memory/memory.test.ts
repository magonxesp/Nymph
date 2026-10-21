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
import { Memory } from "./memory.js"
import type { MemoryObject } from "./memory.js"

const data: MemoryObject = {
    id: "9007199254740993",
    chatId: "telegram:123",
    content: "Nymph usa TypeScript",
    embedding: [1, 0, 0],
    createdAt: new Date("2026-10-21T10:00:00Z"),
    updatedAt: new Date("2026-10-21T11:00:00Z")
}

describe("Memory", () => {
    it("validates a plain object and exposes its validated fields", () => {
        const memory = new Memory(data)

        expect(memory.id.value).toBe(data.id)
        expect(memory.chatId.value).toBe(data.chatId)
        expect(memory.content.value).toBe(data.content)
        expect(memory.embedding?.value).toEqual(data.embedding)
        expect(memory.createdAt).toEqual(data.createdAt)
        expect(memory.updatedAt).toEqual(data.updatedAt)
    })

    it("accepts a memory without an embedding", () => {
        expect(new Memory({ ...data, embedding: null }).embedding).toBeNull()
    })

    it.each([
        { id: "0" },
        { id: "invalid" },
        { chatId: " " },
        { content: " " },
        { embedding: [] },
        { embedding: [0, 0, 0] },
        { embedding: [NaN] },
        { embedding: [Infinity] },
        { createdAt: new Date("invalid") },
        { updatedAt: new Date("invalid") }
    ])("rejects invalid memory fields: %j", invalidFields => {
        expect(() => new Memory({ ...data, ...invalidFields })).toThrow()
    })

    it("copies input arrays and dates to avoid sharing mutable input", () => {
        const embedding = [1, 0, 0]
        const createdAt = new Date(data.createdAt)
        const updatedAt = new Date(data.updatedAt)
        const memory = new Memory({ ...data, embedding, createdAt, updatedAt })

        embedding[0] = 0
        createdAt.setTime(0)
        updatedAt.setTime(0)
        expect(Object.isFrozen(memory.embedding?.value)).toBe(true)

        expect(memory.embedding?.value).toEqual([1, 0, 0])
        expect(memory.createdAt).toEqual(data.createdAt)
        expect(memory.updatedAt).toEqual(data.updatedAt)
    })
})
