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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Memory, generateMemories } from './memory.js'
import type { MemoryHistoryMessage } from './history.js'
import { MemoryContent } from './content.js'
import { Embedding, embedMemoryTexts } from './embedding.js'
import * as embeddingModule from './embedding.js'
import type { MemoryObject } from './memory.js'

const data: MemoryObject = {
	id: '9007199254740993',
	chatId: 'telegram:123',
	content: 'Nymph usa TypeScript',
	embedding: [1, 0, 0],
	createdAt: new Date('2026-10-21T10:00:00Z'),
	updatedAt: new Date('2026-10-21T11:00:00Z')
}

describe('Memory', () => {
	it('validates a plain object and exposes its validated fields', () => {
		const memory = new Memory(data)

		expect(memory.id.value).toBe(data.id)
		expect(memory.chatId.value).toBe(data.chatId)
		expect(memory.content.value).toBe(data.content)
		expect(memory.embedding?.value).toEqual(data.embedding)
		expect(memory.createdAt).toEqual(data.createdAt)
		expect(memory.updatedAt).toEqual(data.updatedAt)
	})

	it('accepts a memory without an embedding', () => {
		expect(new Memory({ ...data, embedding: null }).embedding).toBeNull()
	})

	it.each([
		{ id: '0' },
		{ id: 'invalid' },
		{ chatId: ' ' },
		{ content: ' ' },
		{ embedding: [] },
		{ embedding: [0, 0, 0] },
		{ embedding: [NaN] },
		{ embedding: [Infinity] },
		{ createdAt: new Date('invalid') },
		{ updatedAt: new Date('invalid') }
	])('rejects invalid memory fields: %j', (invalidFields) => {
		expect(() => new Memory({ ...data, ...invalidFields })).toThrow()
	})

	it('copies input arrays and dates to avoid sharing mutable input', () => {
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

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }))

vi.mock('../agent/memory.js', () => ({
	createMemoryAgent: vi.fn(async () => ({ invoke: invokeMock }))
}))

const history: MemoryHistoryMessage[] = [{ role: 'user', text: 'El proyecto se llama Nymph.' }]

describe('generateMemories', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		invokeMock.mockResolvedValue({
			structuredResponse: { memories: ['El proyecto se llama Nymph.'] }
		})
		vi.spyOn(embeddingModule, 'embedMemoryTexts').mockResolvedValue([new Embedding([1, 0, 0])])
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('passes the JSON history and focus to the agent and returns text with its embedding', async () => {
		const config = { tags: ['memory-test'] }
		const memories = await generateMemories(history, 'proyecto', config)

		expect(invokeMock).toHaveBeenCalledWith(
			{
				messages: [
					{
						role: 'user',
						content: JSON.stringify({
							focus: 'proyecto',
							messages: history
						})
					}
				]
			},
			config
		)
		expect(embedMemoryTexts).toHaveBeenCalledWith(['El proyecto se llama Nymph.'])
		expect(memories).toEqual([
			{
				content: new MemoryContent('El proyecto se llama Nymph.'),
				embedding: new Embedding([1, 0, 0])
			}
		])
	})

	it('skips both models for an empty history', async () => {
		expect(await generateMemories([])).toEqual([])
		expect(invokeMock).not.toHaveBeenCalled()
		expect(embedMemoryTexts).not.toHaveBeenCalled()
	})

	it('skips embeddings when the agent finds nothing worth remembering', async () => {
		invokeMock.mockResolvedValue({ structuredResponse: { memories: [] } })

		expect(await generateMemories(history)).toEqual([])
		expect(embedMemoryTexts).not.toHaveBeenCalled()
	})

	it("deduplicates memories and preserves each embedding's correspondence in a batch", async () => {
		invokeMock.mockResolvedValue({
			structuredResponse: { memories: ['Nymph', 'Nymph', 'Miku'] }
		})
		vi.mocked(embedMemoryTexts).mockResolvedValue([new Embedding([1, 0]), new Embedding([0, 1])])

		const memories = await generateMemories(history)

		expect(embedMemoryTexts).toHaveBeenCalledExactlyOnceWith(['Nymph', 'Miku'])
		expect(
			memories.map((memory) => ({
				content: memory.content.value,
				embedding: memory.embedding.value
			}))
		).toEqual([
			{ content: 'Nymph', embedding: [1, 0] },
			{ content: 'Miku', embedding: [0, 1] }
		])
	})

	it('rejects an invalid agent response before generating embeddings', async () => {
		invokeMock.mockResolvedValue({ structuredResponse: { memories: [''] } })

		await expect(generateMemories(history)).rejects.toThrow()
		expect(embedMemoryTexts).not.toHaveBeenCalled()
	})

	it('rejects blank memory content before generating embeddings', async () => {
		invokeMock.mockResolvedValue({
			structuredResponse: { memories: [' '] }
		})

		await expect(generateMemories(history)).rejects.toThrow('blank')
		expect(embedMemoryTexts).not.toHaveBeenCalled()
	})

	it('propagates embedding failures instead of returning incomplete memories', async () => {
		vi.mocked(embedMemoryTexts).mockRejectedValue(new Error('Embedding unavailable'))

		await expect(generateMemories(history)).rejects.toThrow('Embedding unavailable')
	})
})
