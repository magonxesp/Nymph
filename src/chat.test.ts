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

import {describe, expect, it, vi} from "vitest";
import {SingleChatHistory, ChatMessage, ChatSummarizer} from "./chat.js";

const messageMother = (): ChatMessage => ({
    role: "user",
    content: 'Example message'
})

const summarizerMock: ChatSummarizer = {
    summarize: vi.fn()
}

describe('Single Chat History', () => {
    it('compact all chat history when it reach the message count limit', async () => {
        vi.mocked(summarizerMock.summarize).mockResolvedValue(({
            role: 'assistant',
            content: 'Messages summary'
        }))

        const messages = Array(SingleChatHistory.messageCountLimit).fill(messageMother())
        const history = new SingleChatHistory('example-chat-id', messages, summarizerMock);

        expect(history.messagesCount).toBe(messages.length)

        history.addMessage(messageMother())

        await vi.waitFor(() => {
            expect(history.messagesCount).toBe(1)
        });
    })

    it('keep new messages and remove the compacted messages', async () => {
        let resolveSummary!: (message: ChatMessage) => void
        vi.mocked(summarizerMock.summarize).mockImplementation(() => new Promise<ChatMessage>((resolve) => {
            resolveSummary = resolve
        }))

        const messages = Array(SingleChatHistory.messageCountLimit).fill(messageMother())
        const history = new SingleChatHistory('example-chat-id', messages, summarizerMock);

        expect(history.messagesCount).toBe(messages.length)

        history.addMessage(messageMother())
        const newMessagesWhileSummarizing = 30

        for (let i = 0; i < newMessagesWhileSummarizing; i++) {
            history.addMessage(messageMother())
        }

        expect(summarizerMock.summarize).toHaveBeenCalledWith(expect.any(Array))
        expect(vi.mocked(summarizerMock.summarize).mock.lastCall?.[0]).toHaveLength(SingleChatHistory.messageCountLimit + 1)

        resolveSummary({
            role: 'assistant',
            content: 'Messages summary'
        })

        const expectedMessageCount = newMessagesWhileSummarizing + 1
        await vi.waitFor(() => {
            expect(history.messagesCount).toBe(expectedMessageCount)
        })
    })
})
