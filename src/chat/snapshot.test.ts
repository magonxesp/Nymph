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

import { describe, expect, it } from 'vitest'
import { getPrivateChatHistory } from './chat.js'
import { getGroupChatHistory } from './group.js'
import { getChatHistorySnapshot } from './snapshot.js'
import type { ChatReference } from './snapshot.js'

describe('getChatHistorySnapshot', () => {
	it('selects the private or group history using the configured chat type', () => {
		const id = 'telegram:snapshot-routing'
		getPrivateChatHistory(id).addUserMessage('Private message')
		getGroupChatHistory(id).addMessage({
			id: 1,
			role: 'user',
			senderId: '1',
			senderName: 'Ana',
			text: 'Group message',
			timestamp: 1
		})

		const privateSnapshot = getChatHistorySnapshot({ id, type: 'private' })
		const groupSnapshot = getChatHistorySnapshot({ id, type: 'group' })

		expect(privateSnapshot.chatId.value).toBe(id)
		expect(privateSnapshot.messages).toEqual([{ role: 'user', content: 'Private message' }])
		expect(groupSnapshot.chatId.value).toBe(id)
		expect(groupSnapshot.messages).toEqual([
			{
				id: 1,
				role: 'user',
				senderId: '1',
				senderName: 'Ana',
				text: 'Group message',
				timestamp: 1
			}
		])
	})

	it('retrieves a fresh independent snapshot on each call', () => {
		const chat: ChatReference = {
			id: 'telegram:fresh-snapshot',
			type: 'private'
		}
		const history = getPrivateChatHistory(chat.id)
		history.addUserMessage('First message')
		const first = getChatHistorySnapshot(chat)
		history.addUserMessage('Second message')
		const second = getChatHistorySnapshot(chat)
		second.messages.pop()

		expect(first.messages).toHaveLength(1)
		expect(first.lastMessageSequence).toBe(1)
		expect(history.messages).toHaveLength(2)
		expect(second.lastMessageSequence).toBe(2)
	})
})
