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

import { AIMessage, HumanMessage } from "@langchain/core/messages"
import { z } from "zod"
import type { ChatFile } from "./attachment.js"
import { toHumanMessage } from "./message.js"

export type GroupMention = {
    text: string
    userId: string | null
}

export type GroupMessage = {
    id: number
    role: "user" | "assistant"
    senderId: string
    senderName: string
    text: string
    images?: string[]
    files?: ChatFile[]
    timestamp: number
    replyToMessageId?: number
    mentions?: GroupMention[]
}

const groupResponseMessageSchema = z.object({
    text: z.string().describe("Texto de la respuesta, sin Markdown ni HTML"),
    replyToMessageId: z.number().int().nullable().describe("Por defecto null. ID de un mensaje del historial solo para distinguir hilos entre muchos mensajes o aclarar una respuesta específica que sería ambigua sin cita"),
    mentionUserIds: z.array(z.string()).describe("IDs de usuarios del historial a los que mencionar; vacío si no es necesario")
}).strict()

export const groupResponseSchema = z.object({
    messages: z.array(groupResponseMessageSchema).min(1).describe("Mensajes breves en orden de envío; usa tantos como necesites para responder con naturalidad")
}).strict()

export type GroupResponse = z.infer<typeof groupResponseSchema>

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

    public toModelMessages(triggerMessageId: number): (HumanMessage | AIMessage)[] {
        return this._messages.map(message => {
            const content = JSON.stringify({
                messageId: message.id,
                sender: {
                    id: message.senderId,
                    name: message.senderName
                },
                timestamp: message.timestamp,
                replyToMessageId: message.replyToMessageId ?? null,
                mentions: message.mentions ?? [],
                isTrigger: message.id === triggerMessageId,
                text: message.text
            }, undefined, 2)

            if (message.role === "assistant") {
                return new AIMessage(content)
            }

            return toHumanMessage(content, message.images, message.files)
        })
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
