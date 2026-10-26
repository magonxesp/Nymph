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

import { beforeEach, describe, expect, it, vi } from "vitest"
import { embedMemoryTexts } from "./embedding.js"

const { embedDocumentsMock } = vi.hoisted(() => ({ embedDocumentsMock: vi.fn() }))

vi.mock("@langchain/openai", () => ({
    OpenAIEmbeddings: vi.fn(function () {
        return { embedDocuments: embedDocumentsMock }
    })
}))

vi.mock("../env.js", () => ({
    openAIApiKey: "test-key",
    memoryEmbeddingModel: "test-embedding-model"
}))

beforeEach(() => {
    vi.clearAllMocks()
})

describe("Memory embeddings", () => {
    it("skips the API when there are no memories", async () => {
        expect(await embedMemoryTexts([])).toEqual([])
        expect(embedDocumentsMock).not.toHaveBeenCalled()
    })

    it("embeds multiple texts in a single batch and validates the returned vectors", async () => {
        embedDocumentsMock.mockResolvedValue([[1, 0], [0, 1]])

        const embeddings = await embedMemoryTexts(["Nymph", "Miku"])

        expect(embedDocumentsMock).toHaveBeenCalledExactlyOnceWith(["Nymph", "Miku"])
        expect(embeddings.map(embedding => embedding.value)).toEqual([[1, 0], [0, 1]])
    })

    it("rejects missing vectors", async () => {
        embedDocumentsMock.mockResolvedValue([[1, 0]])

        await expect(embedMemoryTexts(["Nymph", "Miku"])).rejects.toThrow("number of vectors")
    })

    it("rejects unusable vectors before they can be stored", async () => {
        embedDocumentsMock.mockResolvedValue([[0, 0]])

        await expect(embedMemoryTexts(["Nymph"])).rejects.toThrow("zero vector")
    })
})
