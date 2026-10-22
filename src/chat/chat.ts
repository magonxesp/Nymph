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
import type { ChatFile } from "./attachment.js"
import { ChatHistory } from "./history.js"

export type ChatMessage = {
    role: 'assistant' | 'user'
    content: string;
    images?: string[]
    files?: ChatFile[]
}

export class PrivateChatHistory extends ChatHistory<ChatMessage> {
    public static readonly messageCountLimit = 100

    public constructor() {
        super(PrivateChatHistory.messageCountLimit)
    }

    public addUserMessage(content: string, images?: string[], files?: ChatFile[]) {
        this.addMessage({
            role: "user",
            content,
            ...(images?.length ? { images } : {}),
            ...(files?.length ? { files } : {})
        })
    }

    public async addAssistantMessage(content: string, mediaUrl?: string): Promise<void> {
        let images: string[] = []

        if (mediaUrl) {
            try {
                images = await downloadImages(mediaUrl)
            } catch (error) {
                log.warn({ err: error, chatId: this.chatId }, 'Failed to download assistant media for chat history')
            }
        }

        this.addMessage({
            role: "assistant",
            content,
            ...(images.length ? { images } : {})
        })
    }
}

const privateChatHistories = new Map<string, PrivateChatHistory>()

export function getPrivateChatHistory(chatId: string): PrivateChatHistory {
    const existingHistory = privateChatHistories.get(chatId)

    if (existingHistory) {
        return existingHistory
    }

    const history = new PrivateChatHistory()
    privateChatHistories.set(chatId, history)

    return history
}
