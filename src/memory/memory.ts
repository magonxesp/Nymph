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

import type { RunnableConfig } from "@langchain/core/runnables"
import { createMemoryAgent } from "../agent/memory.js"
import type { MemoryHistoryMessage } from "./history.js"
import { memoryResponseSchema } from "./response.js"
import { ChatId } from "../chat/id.js"
import type { ChatPlatform } from "../chat/platform.js"
import { MemoryContent } from "./content.js"
import { Embedding, embedMemoryTexts } from "./embedding.js"
import { MemoryId } from "./id.js"

export type MemoryObject = {
	id: string
	chatId: string
	platform: ChatPlatform
	content: string
	embedding: number[] | null
	createdAt: Date
	updatedAt: Date
}

export class Memory {
	public readonly id: MemoryId
	public readonly chatId: ChatId
	public readonly content: MemoryContent
	public readonly embedding: Embedding | null
	public readonly createdAt: Date
	public readonly updatedAt: Date

	public constructor(data: MemoryObject) {
		this.id = new MemoryId(data.id)
		this.chatId = new ChatId(data.chatId, data.platform)
		this.content = new MemoryContent(data.content)
		this.embedding = data.embedding === null ? null : new Embedding(data.embedding)
		this.createdAt = new Date(data.createdAt)
		this.updatedAt = new Date(data.updatedAt)

		if (Number.isNaN(this.createdAt.getTime())) {
			throw new Error("The memory creation date must be valid")
		}

		if (Number.isNaN(this.updatedAt.getTime())) {
			throw new Error("The memory update date must be valid")
		}
	}
}

export type GeneratedMemory = {
	content: MemoryContent
	embedding: Embedding
}

let memoryAgent: ReturnType<typeof createMemoryAgent> | undefined

export async function generateMemories(
	history: MemoryHistoryMessage[],
	focus: string | null = null,
	config?: RunnableConfig
): Promise<GeneratedMemory[]> {
	if (history.length === 0) {
		return []
	}

	memoryAgent ??= createMemoryAgent()
	const agent = await memoryAgent
	const result = await agent.invoke(
		{
			messages: [
				{
					role: "user",
					content: JSON.stringify({ focus, messages: history })
				}
			]
		},
		config
	)
	const response = memoryResponseSchema.parse(result.structuredResponse)
	const contents = [...new Set(response.memories)].map((text) => new MemoryContent(text))

	if (contents.length === 0) {
		return []
	}

	const embeddings = await embedMemoryTexts(contents.map((content) => content.value))

	return contents.map((content, index) => ({
		content,
		embedding: embeddings[index]
	}))
}
