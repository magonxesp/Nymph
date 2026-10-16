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
import { log } from './logging.js'

export interface ChatSummarizer {
    summarize(messages: ChatMessage[]): Promise<ChatMessage>
}

export type ChatMessage = {
    role: 'assistant' | 'user'
    content: string;
}

export class SingleChatHistory {
    private summarizer: ChatSummarizer
    private readonly messages: ChatMessage[] = []
    private isCompacting: boolean = false
    private readonly chatId: string

    public static readonly messageCountLimit = 1000

    public constructor(chatId: string, messages: ChatMessage[], summarizer: ChatSummarizer) {
        this.chatId = chatId;
        this.messages = messages;
        this.summarizer = summarizer
    }

    public addMessage(message: ChatMessage) {
        this.messages.push(message);

        if (!this.isCompacting && this.messagesCount > SingleChatHistory.messageCountLimit) {
            this.isCompacting = true
            const messagesToCompact = this.messages.slice()

            void this.compact(messagesToCompact)
                .catch(error => log.warn({ error, chatId: this.chatId }, 'Failed to compact chat history'))
                .finally(() => this.isCompacting = false)
        }
    }

    public get messagesCount() {
        return this.messages.length
    }

    private async compact(messagesToCompact: ChatMessage[]) {
        const summarizedMessage = await this.summarizer.summarize(messagesToCompact)
        this.messages.splice(0, messagesToCompact.length, summarizedMessage)
    }
}
