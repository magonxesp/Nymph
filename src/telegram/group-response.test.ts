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
import type { GroupMessage } from "../chat/group.js"
import { prepareGroupReplies } from "./group-response.js"

const history: GroupMessage[] = [
	{
		id: 10,
		role: "user",
		senderId: "123",
		senderName: "Ana 🦋",
		text: "Hola",
		timestamp: 1
	},
	{
		id: 11,
		role: "user",
		senderId: "456",
		senderName: "Luis",
		text: "Hola",
		timestamp: 2
	}
]

describe("prepareGroupReplies", () => {
	it("preserves original media URLs and allows a response without text", () => {
		const media = [{ url: "https://example.com/image.jpg", type: "photo" }]
		const replies = prepareGroupReplies(
			{
				messages: [
					{
						text: "",
						media,
						replyToMessageId: 10,
						mentionUserIds: []
					}
				]
			},
			history
		)

		expect(replies).toEqual([
			{
				text: "",
				media,
				entities: [],
				mentions: [],
				replyToMessageId: 10
			}
		])
	})

	it("rejects base64 media before sending the batch", () => {
		expect(() =>
			prepareGroupReplies(
				{
					messages: [
						{
							text: "Hola",
							media: [],
							replyToMessageId: null,
							mentionUserIds: []
						},
						{
							text: "",
							media: [
								{
									url: "data:image/png;base64,AQID",
									type: "photo"
								}
							],
							replyToMessageId: null,
							mentionUserIds: []
						}
					]
				},
				history
			)
		).toThrow()
	})

	it("supports a single plain text message", () => {
		const replies = prepareGroupReplies(
			{
				messages: [
					{
						media: [],
						text: "Hola",
						replyToMessageId: null,
						mentionUserIds: []
					}
				]
			},
			history
		)

		expect(replies).toEqual([
			{
				media: [],
				text: "Hola",
				entities: [],
				mentions: [],
				replyToMessageId: undefined
			}
		])
	})

	it("preserves message order and independent quotes and mentions with UTF-16 offsets", () => {
		const replies = prepareGroupReplies(
			{
				messages: [
					{
						media: [],
						text: "¿Qué opináis?",
						replyToMessageId: 10,
						mentionUserIds: ["123", "456", "123"]
					},
					{
						media: [],
						text: "Os cuento otra cosa.",
						replyToMessageId: null,
						mentionUserIds: []
					},
					{
						media: [],
						text: "Y tú, ¿qué dices?",
						replyToMessageId: 11,
						mentionUserIds: ["456"]
					}
				]
			},
			history
		)

		expect(replies).toEqual([
			{
				media: [],
				text: "Ana 🦋 Luis ¿Qué opináis?",
				entities: [
					{
						type: "text_link",
						offset: 0,
						length: 6,
						url: "tg://user?id=123"
					},
					{
						type: "text_link",
						offset: 7,
						length: 4,
						url: "tg://user?id=456"
					}
				],
				mentions: [
					{ text: "Ana 🦋", userId: "123" },
					{ text: "Luis", userId: "456" }
				],
				replyToMessageId: 10
			},
			{
				media: [],
				text: "Os cuento otra cosa.",
				entities: [],
				mentions: [],
				replyToMessageId: undefined
			},
			{
				media: [],
				text: "Luis Y tú, ¿qué dices?",
				entities: [
					{
						type: "text_link",
						offset: 0,
						length: 4,
						url: "tg://user?id=456"
					}
				],
				mentions: [{ text: "Luis", userId: "456" }],
				replyToMessageId: 11
			}
		])
	})

	it("rejects the whole batch if a later message references an unknown message or user", () => {
		expect(() =>
			prepareGroupReplies(
				{
					messages: [
						{
							media: [],
							text: "Hola",
							replyToMessageId: null,
							mentionUserIds: []
						},
						{
							media: [],
							text: "Otra cosa",
							replyToMessageId: 999,
							mentionUserIds: []
						}
					]
				},
				history
			)
		).toThrow("outside the group history")
		expect(() =>
			prepareGroupReplies(
				{
					messages: [
						{
							media: [],
							text: "Hola",
							replyToMessageId: null,
							mentionUserIds: ["999"]
						}
					]
				},
				history
			)
		).toThrow("unknown group user")
	})

	it("rejects malformed, missing and empty responses", () => {
		expect(() => prepareGroupReplies(undefined, history)).toThrow()
		expect(() => prepareGroupReplies({ messages: [] }, history)).toThrow()
		expect(() =>
			prepareGroupReplies(
				{
					messages: [
						{
							media: [],
							text: "Hola",
							replyToMessageId: "10",
							mentionUserIds: []
						}
					]
				},
				history
			)
		).toThrow()
		expect(() =>
			prepareGroupReplies(
				{
					messages: [
						{
							media: [],
							text: "Hola",
							replyToMessageId: null,
							mentionUserIds: []
						},
						{
							media: [],
							text: "  ",
							replyToMessageId: null,
							mentionUserIds: []
						}
					]
				},
				history
			)
		).toThrow("empty group answer")
	})

	it("rejects channel IDs even if they occur in the history", () => {
		const channelHistory: GroupMessage[] = [
			{
				id: 12,
				role: "user",
				senderId: "-100123",
				senderName: "Canal",
				text: "Hola",
				timestamp: 3
			}
		]

		expect(() =>
			prepareGroupReplies(
				{
					messages: [
						{
							media: [],
							text: "Hola",
							replyToMessageId: null,
							mentionUserIds: ["-100123"]
						}
					]
				},
				channelHistory
			)
		).toThrow("unknown group user")
	})
})
