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

import { describe, expect, it, vi } from "vitest"
import { ChatOpenAI } from "@langchain/openai"
import { createAgent, providerStrategy } from "langchain"
import { createMemoryAgent } from "./memory.js"
import { memoryResponseSchema } from "../memory/response.js"

vi.mock("@langchain/openai", () => ({
	ChatOpenAI: vi.fn(function () {
		return {}
	})
}))

vi.mock("langchain", () => ({
	createAgent: vi.fn(),
	providerStrategy: vi.fn()
}))

vi.mock("../env.js", () => ({
	openAIApiKey: "test-key",
	memoryModel: "custom-memory-model",
	promptsDir: new URL("../../prompts/", import.meta.url).pathname
}))

describe("createMemoryAgent", () => {
	it("configures the memory model without reasoning or conversation tools", async () => {
		await createMemoryAgent()

		expect(ChatOpenAI).toHaveBeenCalledWith({
			apiKey: "test-key",
			model: "custom-memory-model",
			useResponsesApi: true,
			reasoning: { effort: "none" },
			verbosity: "low"
		})
		expect(createAgent).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "memory",
				tools: [],
				systemPrompt: expect.stringContaining("datos JSON")
			})
		)
		expect(providerStrategy).toHaveBeenCalledWith({
			schema: memoryResponseSchema,
			strict: true
		})
	})
})

describe("memoryResponseSchema", () => {
	it("accepts individual memories and an empty list", () => {
		expect(
			memoryResponseSchema.parse({
				memories: ["El proyecto se llama Nymph."]
			})
		).toEqual({ memories: ["El proyecto se llama Nymph."] })
		expect(memoryResponseSchema.parse({ memories: [] })).toEqual({
			memories: []
		})
	})

	it("rejects blank memories and responses outside the expected structure", () => {
		expect(() => memoryResponseSchema.parse({ memories: [""] })).toThrow()
		expect(() => memoryResponseSchema.parse({ memories: "Un recuerdo" })).toThrow()
		expect(() =>
			memoryResponseSchema.parse({
				memories: [],
				explanation: "Nada relevante"
			})
		).toThrow()
	})
})
