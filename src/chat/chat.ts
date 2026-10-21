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
import { log } from '../logging.js'
import { OpenAIChatSummarizer, ChatSummarizer } from './summarizer.js'
import { downloadImages } from '../media/remote.js'

export type ChatMessage = {
    role: 'assistant' | 'user'
    content: string;
    images?: string[]
    files?: ChatFile[]
}

export class PrivateChatHistory {
    private summarizer: ChatSummarizer
    private readonly _messages: ChatMessage[] = []
    private isCompacting: boolean = false
    private readonly chatId: string

    public static readonly messageCountLimit = 1000

    public constructor(chatId: string, messages: ChatMessage[], summarizer: ChatSummarizer) {
        this.chatId = chatId;
        this._messages = messages;
        this.summarizer = summarizer
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

    public addMessage(message: ChatMessage) {
        this._messages.push(message);

        if (!this.isCompacting && this.messagesCount > PrivateChatHistory.messageCountLimit) {
            this.isCompacting = true
            const messagesToCompact = this._messages.slice()
            log.info({ chatId: this.chatId, messages: messagesToCompact.length }, 'Compacting chat history')

            this.compact(messagesToCompact)
                .then(messages => log.info({ chatId: this.chatId, messages }, 'Chat history compact completed'))
                .catch(error => log.warn({ error, chatId: this.chatId }, 'Failed to compact chat history'))
                .finally(() => this.isCompacting = false)
        }
    }

    public get messagesCount() {
        return this._messages.length
    }

    public get messages() {
        return this._messages.slice()
    }

    /**
     * Compact messages into one and return current history message count after compact
     */
    private async compact(messagesToCompact: ChatMessage[]): Promise<number> {
        const summarizedMessage = await this.summarizer.summarize(messagesToCompact)
        this._messages.splice(0, messagesToCompact.length, summarizedMessage)
        return this._messages.length
    }
}

const chatSummarizer: ChatSummarizer = new OpenAIChatSummarizer()
const privateChatHistories = new Map<string, PrivateChatHistory>()

export function getPrivateChatHistory(chatId: string): PrivateChatHistory {
    const existingHistory = privateChatHistories.get(chatId)

    if (existingHistory) {
        return existingHistory
    }

    const history = new PrivateChatHistory(chatId, [], chatSummarizer)
    privateChatHistories.set(chatId, history)

    return history
}
