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

import { ChatId } from "./id.js"
import { AIMessage, HumanMessage } from "@langchain/core/messages"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GroupChatHistory, getGroupChatHistory } from "./group.js"
import { downloadImages } from "../media/remote.js"
import type { GroupMessageContext } from "../telegram/group-message.js"

vi.mock("../media/remote.js", () => ({ downloadImages: vi.fn() }))

beforeEach(() => {
	vi.mocked(downloadImages).mockReset()
})

describe("GroupChatHistory", () => {
	const ctx: GroupMessageContext = {
		message: {
			message_id: 5,
			date: 1,
			chat: { id: -1, type: "group", title: "Test group" },
			text: "Mensaje del usuario"
		},
		me: { id: 99, first_name: "Nymph" }
	}
	const sentMessage = {
		message_id: 1,
		date: 2,
		chat: { id: -1, type: "group" as const, title: "Test group" },
		reply_to_message: { ...ctx.message, reply_to_message: undefined }
	}

	it("stores assistant text without downloading media", async () => {
		const history = new GroupChatHistory(new ChatId("telegram:group-test"))

		await history.addAssistantMessage(ctx, {
			message: sentMessage,
			text: "Hola"
		})

		expect(history.messages).toEqual([
			{
				id: 1,
				senderId: "99",
				senderName: "Nymph",
				role: "assistant",
				text: "Hola",
				timestamp: 2,
				replyToMessageId: 5,
				mentions: []
			}
		])
		expect(downloadImages).not.toHaveBeenCalled()
		expect(history.toModelMessages(2)[0]).toBeInstanceOf(AIMessage)
	})

	it("downloads assistant media and keeps it visible in later model requests", async () => {
		const history = new GroupChatHistory(new ChatId("telegram:group-test"))
		const image = "data:image/jpeg;base64,AQID"
		const url = "https://example.com/image.jpg"
		vi.mocked(downloadImages).mockResolvedValue([image])

		await history.addAssistantMessage(ctx, { message: sentMessage, text: url }, url)

		expect(downloadImages).toHaveBeenCalledWith(url)
		expect(history.messages).toEqual([
			{
				id: 1,
				senderId: "99",
				senderName: "Nymph",
				role: "assistant",
				text: url,
				timestamp: 2,
				replyToMessageId: 5,
				mentions: [],
				images: [image]
			}
		])
		expect(history.toModelMessages(2)[0].content).toEqual([
			{
				type: "text",
				text: expect.stringContaining("Contenido multimedia enviado por el asistente:")
			},
			{ type: "image_url", image_url: { url: image } }
		])
	})

	it("keeps the sent message when downloading assistant media fails", async () => {
		const history = new GroupChatHistory(new ChatId("telegram:group-test"))
		const url = "https://example.com/image.jpg"
		vi.mocked(downloadImages).mockRejectedValue(new Error("Download failed"))

		await history.addAssistantMessage(ctx, { message: sentMessage, text: url }, url)

		expect(history.messages).toEqual([
			{
				id: 1,
				senderId: "99",
				senderName: "Nymph",
				role: "assistant",
				text: url,
				timestamp: 2,
				replyToMessageId: 5,
				mentions: []
			}
		])
	})

	it("keeps only the latest 100 messages, including the trigger", () => {
		const history = new GroupChatHistory(new ChatId("telegram:group-test"))

		for (let id = 1; id <= 101; id++) {
			history.addMessage({
				id,
				role: "user",
				senderId: "1",
				senderName: "Ana",
				text: `Message ${id}`,
				timestamp: id
			})
		}

		expect(history.messages).toHaveLength(100)
		expect(history.messages[0].id).toBe(2)
		expect(history.messages.at(-1)?.id).toBe(101)

		const messages = history.toModelMessages(101)

		expect(messages).toHaveLength(100)
		expect(messages[0].content).toContain('"messageId": 2,')
		expect(messages[0].content).toContain('"isTrigger": false')
		expect(messages.at(-1)?.content).toContain('"messageId": 101,')
		expect(messages.at(-1)?.content).toContain('"isTrigger": true')
	})

	it("preserves sender details and special characters as JSON data", () => {
		const history = new GroupChatHistory(new ChatId("telegram:group-test"))
		history.addMessage({
			id: 5,
			role: "user",
			senderId: "user&1",
			senderName: 'Ana <A> "B"',
			text: "Nymph: <hola> & 'adiós'\n¿Qué dices?",
			timestamp: 12
		})

		const [message] = history.toModelMessages(5)

		expect(message).toBeInstanceOf(HumanMessage)
		expect(message.content).toBe(
			JSON.stringify(
				{
					messageId: 5,
					sender: { id: "user&1", name: 'Ana <A> "B"' },
					timestamp: 12,
					replyToMessageId: null,
					mentions: [],
					isTrigger: true,
					text: "Nymph: <hola> & 'adiós'\n¿Qué dices?"
				},
				undefined,
				2
			)
		)
	})

	it("maps Nymph to assistant messages and preserves reply and mention relationships", () => {
		const history = new GroupChatHistory(new ChatId("telegram:group-test"))
		history.addMessage({
			id: 6,
			role: "assistant",
			senderId: "bot",
			senderName: "Nymph",
			text: "Hola, Ana",
			timestamp: 13
		})
		history.addMessage({
			id: 7,
			role: "user",
			senderId: "1",
			senderName: "Ana",
			text: "Gracias, @nymph",
			timestamp: 14,
			replyToMessageId: 6,
			mentions: [{ text: "@nymph", userId: null }]
		})

		const messages = history.toModelMessages(7)

		expect(messages[0]).toBeInstanceOf(AIMessage)
		expect(messages[0].content).toContain('"isTrigger": false')
		expect(messages[1]).toBeInstanceOf(HumanMessage)
		expect(messages[1].content).toContain('"replyToMessageId": 6')
		expect(messages[1].content).toContain('"text": "@nymph"')
		expect(messages[1].content).toContain('"userId": null')
		expect(messages[1].content).toContain('"isTrigger": true')
	})

	it("keeps separate histories for different groups", () => {
		expect(getGroupChatHistory("group-a")).toBe(getGroupChatHistory("group-a"))
		expect(getGroupChatHistory("group-a")).not.toBe(getGroupChatHistory("group-b"))
	})
})

it("keeps earlier group images available when a later message triggers a response", () => {
	const history = new GroupChatHistory(new ChatId("telegram:group-test"))
	const image = "data:image/jpeg;base64,AQID"
	history.addMessage({
		id: 1,
		role: "user",
		senderId: "1",
		senderName: "Ana",
		text: "Mira esto",
		images: [image],
		timestamp: 1
	})
	history.addMessage({
		id: 2,
		role: "user",
		senderId: "2",
		senderName: "Luis",
		text: "Nymph, ¿qué ves en la foto?",
		timestamp: 2
	})

	const [message] = history.toModelMessages(2)

	expect(message.content).toEqual([
		{ type: "text", text: expect.stringContaining('"isTrigger": false') },
		{ type: "image_url", image_url: { url: image } }
	])
	expect(message.content).toEqual(
		expect.arrayContaining([{ type: "text", text: expect.stringContaining('"name": "Ana"') }])
	)
})

it("keeps files attached to earlier group messages available to the model", () => {
	const history = new GroupChatHistory(new ChatId("telegram:group-test"))
	history.addMessage({
		id: 1,
		role: "user",
		senderId: "1",
		senderName: "Ana",
		text: "Revisa esto",
		timestamp: 1,
		files: [{ filename: "data.csv", mimeType: "text/csv", data: "AQID" }]
	})

	const [message] = history.toModelMessages(2)

	expect(message.content).toEqual([
		{ type: "text", text: expect.stringContaining('"isTrigger": false') },
		{
			type: "input_file",
			filename: "data.csv",
			file_data: "data:text/csv;base64,AQID"
		}
	])
})
