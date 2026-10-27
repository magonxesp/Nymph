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
import { PrivateChatHistory } from "./chat.js"
import type { ChatMessage } from "./chat.js"
import { GroupChatHistory } from "./group.js"
import type { ChatHistorySnapshot } from "./history.js"
import { ChatId } from "./id.js"

describe("Chat history snapshots", () => {
	it("includes the history chat ID in independent snapshot batches", () => {
		const chatId = new ChatId("telegram:123")
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

	it("preserves the chat ID and copies nested group metadata", () => {
		const chatId = new ChatId("telegram:-123")
		const history = new GroupChatHistory(chatId)
		history.addMessage({
			id: 1,
			role: "user",
			senderId: "1",
			senderName: "Ana",
			text: "Hello",
			timestamp: 1,
			mentions: [{ text: "Luis", userId: "2" }]
		})

		const snapshot = history.snapshot
		snapshot.messages[0].mentions?.push({ text: "Other", userId: "3" })

		expect(snapshot.chatId).toBe(history.chatId)
		expect(snapshot.lastMessageSequence).toBe(1)
		expect(history.messages[0].mentions).toEqual([{ text: "Luis", userId: "2" }])
	})
})
