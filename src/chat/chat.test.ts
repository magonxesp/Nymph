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

import {afterEach, describe, expect, it, vi} from "vitest";
import {PrivateChatHistory, ChatMessage, getPrivateChatHistory} from "./chat.js";
import {ChatSummarizer} from "./summarizer.js";

const messageMother = (): ChatMessage => ({
    role: "user",
    content: 'Example message'
})

const summarizerMock: ChatSummarizer = {
    summarize: vi.fn()
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('Single Chat History', () => {
    it('stores assistant text without downloading media', async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        const history = new PrivateChatHistory('assistant-text', [], summarizerMock)

        await history.addAssistantMessage('Hola')

        expect(history.messages).toEqual([{ role: 'assistant', content: 'Hola' }])
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('retains the sent URL when downloading assistant media fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Download failed')))
        const history = new PrivateChatHistory('assistant-media-failure', [], summarizerMock)
        const url = 'https://example.com/image.jpg'

        await history.addAssistantMessage(url, url)

        expect(history.messages).toEqual([{ role: 'assistant', content: url }])
    })

    it('compact all chat history when it reach the message count limit', async () => {
        vi.mocked(summarizerMock.summarize).mockResolvedValue(({
            role: 'assistant',
            content: 'Messages summary'
        }))

        const messages = Array(PrivateChatHistory.messageCountLimit).fill(messageMother())
        const history = new PrivateChatHistory('example-chat-id', messages, summarizerMock);

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

        const messages = Array(PrivateChatHistory.messageCountLimit).fill(messageMother())
        const history = new PrivateChatHistory('example-chat-id', messages, summarizerMock);

        expect(history.messagesCount).toBe(messages.length)

        history.addMessage(messageMother())
        const newMessagesWhileSummarizing = 30

        for (let i = 0; i < newMessagesWhileSummarizing; i++) {
            history.addMessage(messageMother())
        }

        expect(summarizerMock.summarize).toHaveBeenCalledWith(expect.any(Array))
        expect(vi.mocked(summarizerMock.summarize).mock.lastCall?.[0]).toHaveLength(PrivateChatHistory.messageCountLimit + 1)

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

describe('getChatHistory', () => {
    it('reuses the history for a chat and creates a separate history for another chat', () => {
        const firstHistory = getPrivateChatHistory('first-chat')
        const sameHistory = getPrivateChatHistory('first-chat')
        const otherHistory = getPrivateChatHistory('other-chat')

        expect(sameHistory).toBe(firstHistory)
        expect(otherHistory).not.toBe(firstHistory)
        expect(firstHistory.messagesCount).toBe(0)
        expect(otherHistory.messagesCount).toBe(0)
    })
})
