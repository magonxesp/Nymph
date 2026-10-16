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

export type GroupMessage = {
    id: number
    senderId: string
    senderName: string
    text: string
    timestamp: number
}

function escapeXml(value: string): string {
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F&<>"']/g, character => {
        const entities: Record<string, string> = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;"
        }

        return entities[character] ?? ""
    })
}

export class GroupChatHistory {
    public static readonly messageCountLimit = 100

    private readonly _messages: GroupMessage[] = []

    public addMessage(message: GroupMessage): void {
        this._messages.push(message)

        if (this._messages.length > GroupChatHistory.messageCountLimit) {
            this._messages.splice(0, this._messages.length - GroupChatHistory.messageCountLimit)
        }
    }

    public get messages(): GroupMessage[] {
        return this._messages.slice()
    }

    public toXml(triggerMessageId: number): string {
        const messages = this._messages.map(message => {
            const senderId = escapeXml(message.senderId)
            const senderName = escapeXml(message.senderName)
            const text = escapeXml(message.text)

            return `  <message id="${message.id}" sender_id="${senderId}" sender_name="${senderName}" timestamp="${message.timestamp}">${text}</message>`
        }).join("\n")

        return `<group_messages trigger_message_id="${triggerMessageId}">\n${messages}\n</group_messages>`
    }
}

const groupChatHistories = new Map<string, GroupChatHistory>()

export function getGroupChatHistory(chatId: string): GroupChatHistory {
    const existingHistory = groupChatHistories.get(chatId)

    if (existingHistory) {
        return existingHistory
    }

    const history = new GroupChatHistory()
    groupChatHistories.set(chatId, history)

    return history
}
