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
import { ChatId } from "./id.js"
import { ChatPlatform } from "./platform.js"
import { getPrivateChatHistory } from "./chat.js"
import { getGroupChatHistory } from "./group.js"
import { getChatHistorySnapshot } from "./snapshot.js"
import type { ChatReference } from "./snapshot.js"

describe("getChatHistorySnapshot", () => {
	it("selects the private or group history using the configured chat type", () => {
		const id = "snapshot-routing"
		getPrivateChatHistory(new ChatId(String(id), ChatPlatform.Telegram)).addUserMessage("Private message")
		getGroupChatHistory(new ChatId(String(id), ChatPlatform.Telegram)).addMessage({
			id: "1",
			role: "user",
			senderId: "1",
			senderName: "Ana",
			text: "Group message",
			timestamp: 1
		})

		const privateSnapshot = getChatHistorySnapshot({ id, platform: ChatPlatform.Telegram, type: "private" })
		const groupSnapshot = getChatHistorySnapshot({ id, platform: ChatPlatform.Telegram, type: "group" })

		expect(privateSnapshot.chatId.value).toBe(id)
		expect(privateSnapshot.chatId.platform).toBe(ChatPlatform.Telegram)
		expect(privateSnapshot.messages).toEqual([{ role: "user", content: "Private message" }])
		expect(groupSnapshot.chatId.value).toBe(id)
		expect(groupSnapshot.chatId.platform).toBe(ChatPlatform.Telegram)
		expect(groupSnapshot.messages).toEqual([
			{
				id: "1",
				role: "user",
				senderId: "1",
				senderName: "Ana",
				text: "Group message",
				timestamp: 1
			}
		])
	})

	it("retrieves a fresh independent snapshot on each call", () => {
		const chat: ChatReference = {
			id: "fresh-snapshot",
			platform: ChatPlatform.Telegram,
			type: "private"
		}
		const history = getPrivateChatHistory(new ChatId(chat.id, chat.platform))
		history.addUserMessage("First message")
		const first = getChatHistorySnapshot(chat)
		history.addUserMessage("Second message")
		const second = getChatHistorySnapshot(chat)
		second.messages.pop()

		expect(first.messages).toHaveLength(1)
		expect(first.lastMessageSequence).toBe(1)
		expect(history.messages).toHaveLength(2)
		expect(second.lastMessageSequence).toBe(2)
	})
})
