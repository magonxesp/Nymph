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

import type { AIMessage, HumanMessage } from "@langchain/core/messages"
import { z } from "zod"
import type { ChatFile } from "./attachment.js"
import { toModelMessage } from "./message.js"
import { responseMediaListSchema } from "./response.js"
import { ChatHistory } from "./history.js"

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
    media: responseMediaListSchema,
    replyToMessageId: z.number().int().nullable().describe("Por defecto null. ID de un mensaje del historial solo para distinguir hilos entre muchos mensajes o aclarar una respuesta específica que sería ambigua sin cita"),
    mentionUserIds: z.array(z.string()).describe("IDs de usuarios del historial a los que mencionar; vacío si no es necesario")
}).strict()

export const groupResponseSchema = z.object({
    messages: z.array(groupResponseMessageSchema).min(1).describe("Mensajes breves en orden de envío; usa tantos como necesites para responder con naturalidad")
}).strict()

export type GroupResponse = z.infer<typeof groupResponseSchema>

export class GroupChatHistory extends ChatHistory<GroupMessage> {
    public static readonly messageCountLimit = 100

    public constructor() {
        super(GroupChatHistory.messageCountLimit)
    }

    public toModelMessages(triggerMessageId: number): (HumanMessage | AIMessage)[] {
        return this.messages.map(message => {
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

            return toModelMessage({
                role: message.role,
                content,
                images: message.images,
                files: message.files
            })
        })
    }

    public async addAssistantMessage(
        ctx: GroupMessageContext,
        options: GroupMessageOptions = {},
        mediaUrl?: string
    ): Promise<void> {
        const message = createGroupMessage(ctx, "assistant", options)
        let images = message.images ?? []

        if (mediaUrl) {
            try {
                images = await downloadImages(mediaUrl)
            } catch (error) {
                log.warn({ err: error, messageId: message.id }, "Failed to download assistant media for group chat history")
            }
        }

        this.addMessage({
            ...message,
            role: "assistant",
            ...(images.length ? { images } : {})
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
