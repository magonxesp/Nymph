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
import { ChatId } from '../chat/id.js'
import { generateMemories, Memory } from './memory.js'
import * as memoryModule from './memory.js'
import { MemoryContent } from './content.js'
import { Embedding, embedMemoryTexts } from './embedding.js'
import * as embeddingModule from './embedding.js'
import { MemoryRepository } from './repository.js'
import { createMemory, queryMemories, editMemory } from './tools.js'
import { getPrivateChatHistory } from '../chat/chat.js'

vi.mock('../logging.js', () => ({ log: { warn: vi.fn() } }))

const chatId = new ChatId('telegram:123')
const history = getPrivateChatHistory(chatId.value)
history.addUserMessage('El proyecto se llama Nymph.')
const snapshot = history.snapshot
const config = { configurable: { chat: { id: chatId.value, type: 'private' } } }

const memory = new Memory({
	id: '42',
	chatId: chatId.value,
	content: 'El proyecto se llama Nymph.',
	embedding: [1, 0, 0],
	createdAt: new Date('2026-10-26T10:00:00Z'),
	updatedAt: new Date('2026-10-26T10:00:00Z')
})

beforeEach(() => {
	vi.clearAllMocks()
	vi.spyOn(memoryModule, 'generateMemories').mockResolvedValue([
		{
			content: new MemoryContent(memory.content.value),
			embedding: new Embedding([1, 0, 0])
		}
	])
	vi.spyOn(embeddingModule, 'embedMemoryTexts').mockResolvedValue([new Embedding([1, 0, 0])])
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('Memory tools', () => {
	it('delegates the trusted history to the memory agent and saves its extracted texts', async () => {
		const insert = vi.spyOn(MemoryRepository.prototype, 'insertMany').mockResolvedValue([memory])

		await expect(createMemory.invoke({ focus: 'proyecto' }, config)).resolves.toEqual({
			memories: [{ id: '42', content: memory.content.value }]
		})
		expect(generateMemories).toHaveBeenCalledWith(
			[{ role: 'user', text: snapshot.messages[0].content }],
			'proyecto',
			expect.any(Object)
		)
		expect(embedMemoryTexts).not.toHaveBeenCalled()
		expect(insert).toHaveBeenCalledWith(chatId, [
			{
				content: memory.content,
				embedding: memory.embedding
			}
		])
	})

	it('does not embed or write when there are no relevant memories', async () => {
		vi.mocked(generateMemories).mockResolvedValue([])
		const insert = vi.spyOn(MemoryRepository.prototype, 'insertMany')

		await expect(createMemory.invoke({ focus: null }, config)).resolves.toEqual({
			memories: []
		})
		expect(embedMemoryTexts).not.toHaveBeenCalled()
		expect(insert).not.toHaveBeenCalled()
	})

	it('queries only the chat supplied by the application and returns no vectors', async () => {
		const search = vi.spyOn(MemoryRepository.prototype, 'search').mockResolvedValue([{ memory, distance: 0.1 }])

		await expect(queryMemories.invoke({ query: '¿Cómo se llama el proyecto?' }, config)).resolves.toEqual({
			memories: [{ id: '42', content: memory.content.value, distance: 0.1 }]
		})
		expect(search).toHaveBeenCalledWith(chatId, new Embedding([1, 0, 0]), 5)
	})

	it('keeps static tools isolated by each configured chat', async () => {
		const search = vi.spyOn(MemoryRepository.prototype, 'search').mockResolvedValue([])
		const otherChatId = new ChatId('telegram:456')
		const otherConfig = {
			configurable: { chat: { id: otherChatId.value, type: 'group' } }
		}

		await Promise.all([
			queryMemories.invoke({ query: 'Nymph' }, config),
			queryMemories.invoke({ query: 'Miku' }, otherConfig)
		])

		expect(search).toHaveBeenCalledWith(chatId, expect.any(Embedding), 5)
		expect(search).toHaveBeenCalledWith(otherChatId, expect.any(Embedding), 5)
	})

	it('regenerates the embedding when editing a memory', async () => {
		const updated = new Memory({
			id: '42',
			chatId: chatId.value,
			content: 'El proyecto se llama Miku.',
			embedding: [1, 0, 0],
			createdAt: memory.createdAt,
			updatedAt: memory.updatedAt
		})
		const update = vi.spyOn(MemoryRepository.prototype, 'update').mockResolvedValue(updated)

		await expect(editMemory.invoke({ id: '42', content: updated.content.value }, config)).resolves.toEqual({
			memory: { id: '42', content: updated.content.value }
		})
		expect(embedMemoryTexts).toHaveBeenCalledWith([updated.content.value])
		expect(update).toHaveBeenCalledWith(chatId, memory.id, {
			content: updated.content,
			embedding: updated.embedding
		})
	})

	it('does not claim an edit succeeded if the ID does not belong to the chat', async () => {
		vi.spyOn(MemoryRepository.prototype, 'update').mockResolvedValue(undefined)

		await expect(editMemory.invoke({ id: '42', content: memory.content.value }, config)).resolves.toEqual({
			error: 'No existe un recuerdo con ese ID en el chat actual.'
		})
	})

	it('rejects a chat ID supplied as a model argument', async () => {
		await expect(queryMemories.invoke({ query: 'proyecto', chatId: 'telegram:other' }, config)).rejects.toThrow()
	})

	it('loads the current history only when the tool is invoked', async () => {
		const source = getPrivateChatHistory('telegram:tool-live-history')
		source.addUserMessage('Original text')
		const liveConfig = {
			configurable: { chat: { id: source.chatId.value, type: 'private' } }
		}
		vi.mocked(generateMemories).mockResolvedValue([])
		source.addUserMessage('Later message')

		await createMemory.invoke({ focus: null }, liveConfig)

		expect(generateMemories).toHaveBeenCalledWith(
			[
				{ role: 'user', text: 'Original text' },
				{ role: 'user', text: 'Later message' }
			],
			null,
			expect.any(Object)
		)
	})

	it('fails before accessing embeddings when no chat is configured', async () => {
		await expect(queryMemories.invoke({ query: 'Nymph' })).resolves.toHaveProperty('error')
		expect(embedMemoryTexts).not.toHaveBeenCalled()
	})

	it('returns an error without claiming persistence when the database fails', async () => {
		vi.spyOn(MemoryRepository.prototype, 'insertMany').mockRejectedValue(new Error('Database unavailable'))

		await expect(createMemory.invoke({ focus: null }, config)).resolves.toHaveProperty('error')
	})

	it('does not write when memory generation fails', async () => {
		vi.mocked(generateMemories).mockRejectedValue(new Error('Memory generation failed'))
		const insert = vi.spyOn(MemoryRepository.prototype, 'insertMany')

		await expect(createMemory.invoke({ focus: null }, config)).resolves.toHaveProperty('error')
		expect(insert).not.toHaveBeenCalled()
		expect(embedMemoryTexts).not.toHaveBeenCalled()
	})
})
