import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AIMessage, ToolMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import * as boards from './client.js'
import type { BooruClient } from './client.js'
import type { Post } from './post.js'
import {
	booruAutocompleteTags,
	booruPosts,
	booruRandomPost,
	booruTools,
	rule34AutocompleteTags,
	rule34RandomPost
} from './tools.js'
import { downloadImages } from '../media/remote.js'
import agentTools from '../agent/tools.js'
import { Rule34Client } from './gelbooru.js'

vi.mock('../media/remote.js', () => ({ downloadImages: vi.fn() }))

const post: Post = {
	id: 42,
	file_url: 'https://example.com/image.jpg',
	tags: 'sky',
	rating: 's',
	score: 5
}
const image = 'data:image/jpeg;base64,AQID'
const client: BooruClient = {
	getPosts: vi.fn(),
	getRandomPost: vi.fn(),
	autocompleteTags: vi.fn()
}

beforeEach(() => {
	vi.spyOn(boards, 'getBooruClient').mockReturnValue(client)
	vi.mocked(downloadImages).mockResolvedValue([image])
	vi.mocked(client.getRandomPost).mockResolvedValue(post)
	vi.mocked(client.getPosts).mockResolvedValue({
		count: 1,
		offset: 0,
		items: [post]
	})
	vi.mocked(client.autocompleteTags).mockResolvedValue([{ label: 'sky', value: 'sky' }])
})

afterEach(() => {
	vi.restoreAllMocks()
	vi.resetAllMocks()
})

describe('Booru tools', () => {
	it('registers all booru tools with the agent', () => {
		for (const tool of booruTools) {
			expect(agentTools.filter((agentTool) => agentTool.name === tool.name)).toEqual([tool])
		}
	})

	it.each(boards.booruNames.filter((board) => board !== 'rule34'))(
		'selects %s and forwards the tag',
		async (booru) => {
			await booruRandomPost.invoke({ booru, tag: 'sky' })

			expect(boards.getBooruClient).toHaveBeenCalledWith(booru)
			expect(client.getRandomPost).toHaveBeenCalledWith('sky')
			expect(downloadImages).toHaveBeenCalledWith(post.file_url)
		}
	)

	it.each([booruAutocompleteTags, booruRandomPost, booruPosts])('excludes Rule34 from $name', async (tool) => {
		await expect(tool.schema.parseAsync({ booru: 'rule34', tag: 'sky' })).rejects.toThrow()
		expect(boards.getBooruClient).not.toHaveBeenCalled()
	})

	it('validates board names and nonempty tags', async () => {
		await expect(booruRandomPost.schema.parseAsync({ booru: 'unknown', tag: 'sky' })).rejects.toThrow()
		await expect(booruRandomPost.invoke({ booru: 'danbooru', tag: '   ' })).rejects.toThrow()
		expect(boards.getBooruClient).not.toHaveBeenCalled()
	})

	it('returns suggestions from the selected board', async () => {
		await expect(booruAutocompleteTags.invoke({ booru: 'safebooru', tag: 'sk' })).resolves.toEqual([
			{ label: 'sky', value: 'sky' }
		])
		expect(boards.getBooruClient).toHaveBeenCalledWith('safebooru')
		expect(client.autocompleteTags).toHaveBeenCalledWith('sk')
	})

	it('returns pagination metadata and visual content for every post', async () => {
		const secondPost: Post = {
			...post,
			id: 43,
			file_url: 'https://example.com/second.jpg'
		}
		vi.mocked(client.getPosts).mockResolvedValue({
			count: 20,
			offset: 2,
			items: [post, secondPost]
		})

		const result = await booruPosts.invoke({
			booru: 'konachan.net',
			tag: 'sky',
			page: 1,
			limit: 2
		})

		if (!Array.isArray(result)) {
			throw new Error('Expected visual tool content')
		}

		expect(client.getPosts).toHaveBeenCalledWith('sky', {
			page: 1,
			limit: 2
		})
		expect(result[0]).toEqual({
			type: 'text',
			text: JSON.stringify({
				booru: 'konachan.net',
				count: 20,
				offset: 2
			})
		})
		expect(result.filter((block) => block.type === 'image_url')).toHaveLength(2)
		expect(downloadImages).toHaveBeenCalledWith(secondPost.file_url)
	})

	it('keeps empty search results distinct from errors', async () => {
		vi.mocked(client.getRandomPost).mockResolvedValue(undefined)
		await expect(booruRandomPost.invoke({ booru: 'danbooru', tag: 'sky' })).resolves.toBe(
			'No se encontraron posts en danbooru para el tag sky.'
		)
		expect(downloadImages).not.toHaveBeenCalled()
	})

	it('reports API failures without throwing', async () => {
		vi.mocked(client.getRandomPost).mockRejectedValue(new Error('HTTP 503'))
		vi.mocked(client.getPosts).mockRejectedValue('Connection lost')
		vi.mocked(client.autocompleteTags).mockRejectedValue(new Error('Invalid tags'))

		await expect(booruRandomPost.invoke({ booru: 'danbooru', tag: 'sky' })).resolves.toEqual({
			error: 'HTTP 503'
		})
		await expect(booruPosts.invoke({ booru: 'danbooru', tag: 'sky' })).resolves.toEqual({
			error: 'Connection lost'
		})
		await expect(booruAutocompleteTags.invoke({ booru: 'danbooru', tag: 'sk' })).resolves.toEqual({
			error: 'Invalid tags'
		})
	})

	it('retains metadata and reports when the image download fails', async () => {
		vi.mocked(downloadImages).mockRejectedValue(new Error('Media failed'))
		const result = await booruRandomPost.invoke({
			booru: 'danbooru',
			tag: 'sky'
		})

		if (!Array.isArray(result)) {
			throw new Error('Expected visual tool content')
		}

		expect(result[0]).toEqual({
			type: 'text',
			text: JSON.stringify({ booru: 'danbooru', post })
		})
		expect(result).toContainEqual(
			expect.objectContaining({
				text: expect.stringContaining('No se pudo descargar')
			})
		)
		expect(result.some((block) => block.type === 'image_url')).toBe(false)
	})

	it('uses an available sample when the original file is inaccessible', async () => {
		vi.mocked(client.getRandomPost).mockResolvedValue({
			...post,
			file_url: '',
			sample_url: 'https://example.com/sample.jpg'
		})
		await booruRandomPost.invoke({ booru: 'danbooru', tag: 'sky' })
		expect(downloadImages).toHaveBeenCalledWith('https://example.com/sample.jpg')
	})

	it('reports posts without accessible image URLs', async () => {
		vi.mocked(client.getRandomPost).mockResolvedValue({
			...post,
			file_url: ''
		})
		const result = await booruRandomPost.invoke({
			booru: 'danbooru',
			tag: 'sky'
		})

		if (!Array.isArray(result)) {
			throw new Error('Expected visual tool content')
		}
		expect(result).toContainEqual({
			type: 'text',
			text: 'El post no tiene una imagen accesible.'
		})
		expect(downloadImages).not.toHaveBeenCalled()
	})

	it('attaches all animation frames returned by the downloader', async () => {
		vi.mocked(downloadImages).mockResolvedValue([image, 'data:image/jpeg;base64,BAUG'])
		const result = await booruRandomPost.invoke({
			booru: 'yandere',
			tag: 'sky'
		})

		if (!Array.isArray(result)) {
			throw new Error('Expected visual tool content')
		}
		expect(result.filter((block) => block.type === 'image_url')).toHaveLength(2)
	})

	it('passes the actual image through a ToolMessage to the model request', async () => {
		const result = await booruRandomPost.invoke({
			type: 'tool_call',
			id: 'call-image',
			name: 'booru_random_post',
			args: { booru: 'danbooru', tag: 'sky' }
		})
		expect(result).toBeInstanceOf(ToolMessage)
		expect(result.content).toContainEqual({
			type: 'image_url',
			image_url: { url: image }
		})

		const requests = vi.fn()
		const model = new ChatOpenAI({
			apiKey: 'test-key',
			model: 'test-model',
			useResponsesApi: true,
			configuration: {
				fetch: async (input, init) => {
					requests(await new Request(input, init).json())
					return Response.json({
						id: 'resp_test',
						object: 'response',
						created_at: 0,
						status: 'completed',
						model: 'test-model',
						output: [
							{
								id: 'msg_test',
								type: 'message',
								role: 'assistant',
								status: 'completed',
								content: [
									{
										type: 'output_text',
										text: 'OK',
										annotations: []
									}
								]
							}
						]
					})
				}
			}
		})
		await model.invoke([
			new AIMessage({
				content: '',
				tool_calls: [
					{
						id: 'call-image',
						name: 'booru_random_post',
						args: { booru: 'danbooru', tag: 'sky' }
					}
				]
			}),
			result
		])
		expect(requests).toHaveBeenCalledWith(
			expect.objectContaining({
				input: expect.arrayContaining([
					expect.objectContaining({
						type: 'function_call_output',
						call_id: 'call-image',
						output: expect.arrayContaining([
							expect.objectContaining({
								type: 'input_image',
								image_url: image
							})
						])
					})
				])
			})
		)
	})
})

describe('Rule34 tools', () => {
	it('returns autocomplete error details to the model without throwing', async () => {
		vi.spyOn(Rule34Client.prototype, 'autocompleteTags').mockRejectedValue(
			new Error('Booru request failed with HTTP 503')
		)

		await expect(rule34AutocompleteTags.invoke({ tag: 'example' })).resolves.toEqual({
			error: 'Booru request failed with HTTP 503'
		})
	})

	it('returns random post error details to the model without throwing', async () => {
		vi.spyOn(Rule34Client.prototype, 'getRandomPost').mockRejectedValue(new Error('Invalid booru posts response'))

		await expect(rule34RandomPost.invoke({ tag: 'example' })).resolves.toEqual({
			error: 'Invalid booru posts response'
		})
	})

	it('handles failures that are not Error instances', async () => {
		vi.spyOn(Rule34Client.prototype, 'autocompleteTags').mockRejectedValue('Connection lost')

		await expect(rule34AutocompleteTags.invoke({ tag: 'example' })).resolves.toEqual({
			error: 'Connection lost'
		})
	})

	it('keeps empty searches distinct from failures', async () => {
		vi.spyOn(Rule34Client.prototype, 'getRandomPost').mockResolvedValue(undefined)

		await expect(rule34RandomPost.invoke({ tag: 'example' })).resolves.toBe(
			'No se encontraron posts para el tag example.'
		)
	})

	it('returns tag suggestions on success', async () => {
		const tags = [{ label: 'example', value: 'example' }]
		vi.spyOn(Rule34Client.prototype, 'autocompleteTags').mockResolvedValue(tags)

		await expect(rule34AutocompleteTags.invoke({ tag: 'example' })).resolves.toEqual(tags)
	})

	it('returns the original URL as ToolMessage content', async () => {
		vi.spyOn(Rule34Client.prototype, 'getRandomPost').mockResolvedValue(post)

		const result = await rule34RandomPost.invoke({
			type: 'tool_call',
			id: 'call-image',
			name: 'rule34_random_post',
			args: { tag: 'sky' }
		})

		expect(result).toBeInstanceOf(ToolMessage)
		expect(result.tool_call_id).toBe('call-image')
		expect(result.content).toBe(post.file_url)
		expect(downloadImages).not.toHaveBeenCalled()
	})

	it('returns the original URL when invoked directly', async () => {
		vi.spyOn(Rule34Client.prototype, 'getRandomPost').mockResolvedValue(post)

		await expect(rule34RandomPost.invoke({ tag: 'sky' })).resolves.toBe(post.file_url)
		expect(downloadImages).not.toHaveBeenCalled()
	})
})
