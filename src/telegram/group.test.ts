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

import { Api, Context } from 'grammy'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleGroupMessage } from './group.js'
import { getGroupChatHistory } from '../chat/group.js'
import { maxAttachmentBytes } from './attachment.js'

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }))

vi.mock('../media/image.js', () => ({
	resizeImage: async (bytes: Buffer) => bytes
}))

vi.mock('../agent/agent.js', () => ({
	createGroupChatAgent: vi.fn(async () => ({ invoke: invokeMock }))
}))

const me = {
	id: 99,
	is_bot: true as const,
	first_name: 'Nymph',
	username: 'nymph_bot',
	can_join_groups: true,
	can_read_all_group_messages: true,
	supports_inline_queries: false,
	can_connect_to_business: false,
	has_main_web_app: false,
	has_topics_enabled: false,
	allows_users_to_create_topics: false,
	can_manage_bots: false,
	supports_join_request_queries: false
}

afterEach(() => {
	vi.unstubAllGlobals()
	vi.clearAllMocks()
})

describe('group reply triggers', () => {
	it.each([
		{ senderId: me.id, isBot: true, triggered: true },
		{ senderId: 100, isBot: true, triggered: false },
		{ senderId: 1, isBot: false, triggered: false }
	])('triggers $triggered when replying to sender $senderId', async ({ senderId, isBot, triggered }) => {
		const chat = {
			id: -8200 - senderId,
			type: 'group' as const,
			title: 'Test group'
		}
		const ctx = new Context(
			{
				update_id: 20,
				message: {
					message_id: 20,
					date: 123,
					chat,
					from: { id: 2, is_bot: false, first_name: 'Ana' },
					text: 'Vale',
					reply_to_message: {
						message_id: 19,
						date: 122,
						chat,
						from: {
							id: senderId,
							is_bot: isBot,
							first_name: 'Sender'
						},
						reply_to_message: undefined,
						text: 'Un mensaje anterior'
					}
				}
			},
			new Api('test-token'),
			me
		)
		invokeMock.mockResolvedValue({
			structuredResponse: {
				messages: [
					{
						text: 'Entendido',
						media: [],
						replyToMessageId: null,
						mentionUserIds: []
					}
				]
			}
		})
		const reply = vi.spyOn(ctx, 'reply').mockResolvedValue({
			message_id: 21,
			date: 124,
			chat,
			text: 'Entendido'
		})

		if (!ctx.has('message')) {
			throw new Error('Expected a message context')
		}

		await handleGroupMessage(ctx)

		expect(invokeMock).toHaveBeenCalledTimes(triggered ? 1 : 0)
		expect(reply).toHaveBeenCalledTimes(triggered ? 1 : 0)
	})
})

describe('handleGroupMessage images', () => {
	it('sends the original Rule34 URL as a photo with mentions and a reply', async () => {
		const chat = { id: -8101, type: 'group' as const, title: 'Test group' }
		const ctx = new Context(
			{
				update_id: 10,
				message: {
					message_id: 10,
					date: 123,
					chat,
					from: { id: 1, is_bot: false, first_name: 'Ana' },
					text: '@nymph_bot busca una imagen',
					entities: [{ type: 'mention', offset: 0, length: 10 }]
				}
			},
			new Api('test-token'),
			me
		)
		const media = [{ url: 'https://example.com/original.jpg', type: 'photo' }]
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(
				async () =>
					new Response(new Uint8Array([1, 2, 3]), {
						headers: { 'content-type': 'image/jpeg' }
					})
			)
		)
		invokeMock.mockResolvedValue({
			structuredResponse: {
				messages: [
					{
						text: 'Un pequeño comentario',
						media,
						replyToMessageId: 10,
						mentionUserIds: ['1']
					}
				]
			}
		})
		const reply = vi.spyOn(ctx, 'reply').mockResolvedValue({
			message_id: 11,
			date: 124,
			chat,
			text: 'Un pequeño comentario'
		})
		const photo = vi.spyOn(ctx, 'replyWithPhoto').mockResolvedValue({
			message_id: 12,
			date: 124,
			chat,
			photo: [
				{
					file_id: 'sent',
					file_unique_id: 'sent',
					width: 100,
					height: 100
				}
			]
		})

		if (!ctx.has('message')) {
			throw new Error('Expected a message context')
		}

		await handleGroupMessage(ctx)

		expect(invokeMock.mock.calls[0][1].configurable).toEqual({
			chat: { id: `telegram:${chat.id}`, type: 'group' }
		})
		expect(reply).toHaveBeenCalledWith('Ana Un pequeño comentario', {
			entities: [
				{
					type: 'text_link',
					offset: 0,
					length: 3,
					url: 'tg://user?id=1'
				}
			],
			reply_parameters: {
				message_id: 10,
				allow_sending_without_reply: true
			}
		})
		expect(photo).toHaveBeenCalledWith(media[0].url, {
			reply_parameters: {
				message_id: 10,
				allow_sending_without_reply: true
			}
		})
		expect(getGroupChatHistory(`telegram:${chat.id}`).messages.at(-1)?.text).toBe(media[0].url)
		expect(getGroupChatHistory(`telegram:${chat.id}`).messages.at(-1)?.images).toEqual([
			'data:image/jpeg;base64,AQID'
		])

		await handleGroupMessage(ctx)

		expect(invokeMock.mock.calls[1][0].messages[2].content).toEqual([
			{
				type: 'text',
				text: expect.stringContaining('Contenido multimedia enviado por el asistente:')
			},
			{
				type: 'image_url',
				image_url: { url: 'data:image/jpeg;base64,AQID' }
			}
		])
	})
})

it.each([
	{ mimeType: 'application/pdf', size: maxAttachmentBytes + 1 },
	{ mimeType: 'application/zip', size: 100 }
])('silently discards rejected group attachments: $mimeType, $size', async ({ mimeType, size }) => {
	const chat = { id: -8002, type: 'group' as const, title: 'Test group' }
	const api = new Api('test-token')
	const getFile = vi.spyOn(api, 'getFile')
	const ctx = new Context(
		{
			update_id: 2,
			message: {
				message_id: 2,
				date: 123,
				chat,
				from: { id: 1, is_bot: false, first_name: 'Ana' },
				caption: '@nymph_bot revisa este archivo',
				caption_entities: [{ type: 'mention', offset: 0, length: 10 }],
				document: {
					file_id: 'huge',
					file_unique_id: 'huge',
					file_size: size,
					mime_type: mimeType
				}
			}
		},
		api,
		me
	)
	const reply = vi.spyOn(ctx, 'reply')

	if (!ctx.has('message')) {
		throw new Error('Expected a message context')
	}

	await handleGroupMessage(ctx)

	expect(getGroupChatHistory(`telegram:${chat.id}`).messages).toEqual([])
	expect(getFile).not.toHaveBeenCalled()
	expect(invokeMock).not.toHaveBeenCalled()
	expect(reply).not.toHaveBeenCalled()
})
