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

import type { ChatHistorySnapshot } from "../chat/history.js"
import type { ChatMessage } from "../chat/chat.js"
import type { GroupMessage } from "../chat/group.js"

export type MemoryHistoryMessage = {
    role: "user" | "assistant"
    text: string
    id?: number
    senderId?: string
    senderName?: string
    timestamp?: number
    replyToMessageId?: number
    mentions?: { text: string; userId: string | null }[]
}

export type MemoryHistorySnapshot = ChatHistorySnapshot<ChatMessage | GroupMessage>

export function createMemoryHistory(snapshot: MemoryHistorySnapshot): MemoryHistoryMessage[] {
    return snapshot.messages.map(message => {
        if ("text" in message) {
            return {
                role: message.role,
                text: message.text,
                id: message.id,
                senderId: message.senderId,
                senderName: message.senderName,
                timestamp: message.timestamp,
                replyToMessageId: message.replyToMessageId,
                mentions: message.mentions?.map(mention => ({ ...mention }))
            }
        }

        return { role: message.role, text: message.content }
    })
}
