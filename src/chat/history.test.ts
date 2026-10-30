import { UserId } from "./user-id.js"
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

import { ChatPlatform } from "./platform.js"
import { describe, expect, it } from "vitest"
import { PrivateChatHistory } from "./chat.js"
import type { ChatMessage } from "./chat.js"
import { GroupChatHistory } from "./group.js"
import type { ChatHistorySnapshot } from "./history.js"
import { ChatId } from "./id.js"

describe("Chat history snapshots", () => {
	it("includes the history chat ID in independent snapshot batches", () => {
		const chatId = new ChatId("123", ChatPlatform.Telegram)
		const history = new PrivateChatHistory(chatId)
		const snapshots: ChatHistorySnapshot<ChatMessage>[] = []
		history.on("snapshot", (snapshot) => snapshots.push(snapshot))

		for (let index = 1; index <= 200; index++) {
			history.addUserMessage(`Message ${index}`)
		}

		expect(history.chatId).toBe(chatId)
		expect(snapshots.map((snapshot) => snapshot.chatId)).toEqual([chatId, chatId])
		expect(snapshots.map((snapshot) => snapshot.lastMessageSequence)).toEqual([100, 200])
		expect(snapshots[0].messages[0].content).toBe("Message 1")
		expect(snapshots[1].messages[0].content).toBe("Message 101")
		expect(history.messagesCount).toBe(100)

		const snapshot = history.snapshot
		snapshot.messages[0].content = "Modified snapshot"
		expect(history.messages[0].content).toBe("Message 101")
	})

	it("isolates private snapshot images and files from history", () => {
		const history = new PrivateChatHistory(new ChatId("123", ChatPlatform.Telegram))
		history.addUserMessage(
			"Hello",
			["image.png"],
			[{ filename: "notes.txt", mimeType: "text/plain", data: "aGVsbG8=" }]
		)

		const snapshot = history.snapshot
		snapshot.messages[0].images?.push("other.png")
		snapshot.messages[0].files?.forEach((file) => {
			file.filename = "modified.txt"
		})
		snapshot.messages[0].files?.push({ filename: "other.txt", mimeType: "text/plain", data: "" })

		expect(history.messages[0].images).toEqual(["image.png"])
		expect(history.messages[0].files).toEqual([{ filename: "notes.txt", mimeType: "text/plain", data: "aGVsbG8=" }])
	})

	it("preserves the chat ID and copies nested group metadata", () => {
		const chatId = new ChatId("-123", ChatPlatform.Telegram)
		const history = new GroupChatHistory(chatId)
		history.addMessage({
			id: "1",
			role: "user",
			senderId: "1",
			senderName: "Ana",
			text: "Hello",
			timestamp: 1,
			images: ["image.png"],
			files: [{ filename: "notes.txt", mimeType: "text/plain", data: "aGVsbG8=" }],
			mentions: [
				{ text: "Luis", userId: new UserId("2", "Luis", ChatPlatform.Telegram) },
				{ text: "Unknown", userId: null }
			]
		})

		const snapshot = history.snapshot
		expect(snapshot.messages[0].mentions?.[0].userId).toBeInstanceOf(UserId)
		expect(snapshot.messages[0].mentions?.[0].userId).not.toBe(history.messages[0].mentions?.[0].userId)
		snapshot.messages[0].images?.push("other.png")
		snapshot.messages[0].files?.forEach((file) => {
			file.filename = "modified.txt"
		})
		snapshot.messages[0].files?.push({ filename: "other.txt", mimeType: "text/plain", data: "" })
		snapshot.messages[0].mentions?.forEach((mention) => {
			mention.text = "Modified mention"
		})
		snapshot.messages[0].mentions?.push({ text: "Other", userId: new UserId("3", "Other", ChatPlatform.Telegram) })

		expect(snapshot.chatId).toBe(history.chatId)
		expect(snapshot.lastMessageSequence).toBe(1)
		expect(history.messages[0].images).toEqual(["image.png"])
		expect(history.messages[0].files).toEqual([{ filename: "notes.txt", mimeType: "text/plain", data: "aGVsbG8=" }])
		expect(history.messages[0].mentions).toEqual([
			{ text: "Luis", userId: new UserId("2", "Luis", ChatPlatform.Telegram) },
			{ text: "Unknown", userId: null }
		])
	})
})
