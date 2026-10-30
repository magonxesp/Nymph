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

import { Api, Context } from "grammy"
import type { Filter } from "grammy"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createMessageDebouncer } from "./message-debounce.js"

const me = {
	id: 99,
	is_bot: true as const,
	first_name: "Nymph",
	username: "nymph_bot",
	can_join_groups: true,
	can_read_all_group_messages: true,
	supports_inline_queries: false,
	can_connect_to_business: false,
	has_main_web_app: false,
	has_topics_enabled: false,
	allows_users_to_create_topics: false,
	can_manage_bots: false,
	supports_join_request_queries: false
}

function message(chatId: number, messageId: number, threadId?: number): Filter<Context, "message"> {
	const ctx = new Context(
		{
			update_id: messageId,
			message: {
				message_id: messageId,
				message_thread_id: threadId,
				from: { id: 1, is_bot: false, first_name: "Ana" },
				date: 123,
				chat: { id: chatId, type: "private", first_name: "Ana" },
				text: `Message ${messageId}`
			}
		},
		new Api("test-token"),
		me
	)

	if (!ctx.has("message")) {
		throw new Error("Expected a message context")
	}

	return ctx
}

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

it("waits 2.5 seconds after the last message and retains the entire batch in order", async () => {
	const handleMessages = vi.fn().mockResolvedValue(undefined)
	const enqueue = createMessageDebouncer(handleMessages, vi.fn())
	const first = message(1, 1)
	const second = message(1, 2)

	enqueue(first)
	await vi.advanceTimersByTimeAsync(700)
	enqueue(second)
	await vi.advanceTimersByTimeAsync(2499)

	expect(handleMessages).not.toHaveBeenCalled()

	await vi.advanceTimersByTimeAsync(1)

	expect(handleMessages).toHaveBeenCalledExactlyOnceWith([first, second])

	const third = message(1, 3)
	enqueue(third)
	await vi.advanceTimersByTimeAsync(2500)

	expect(handleMessages).toHaveBeenLastCalledWith([third])
})

it("keeps chats and topics independent", async () => {
	const handleMessages = vi.fn().mockResolvedValue(undefined)
	const enqueue = createMessageDebouncer(handleMessages, vi.fn())
	const first = message(1, 1, 10)
	const otherChat = message(2, 2, 10)
	const otherTopic = message(1, 3, 20)

	enqueue(first)
	await vi.advanceTimersByTimeAsync(500)
	enqueue(otherChat)
	enqueue(otherTopic)
	await vi.advanceTimersByTimeAsync(2000)

	expect(handleMessages).toHaveBeenCalledExactlyOnceWith([first])

	await vi.advanceTimersByTimeAsync(500)

	expect(handleMessages).toHaveBeenCalledTimes(3)
	expect(handleMessages).toHaveBeenCalledWith([otherChat])
	expect(handleMessages).toHaveBeenCalledWith([otherTopic])
})

it("reports asynchronous handler errors and accepts subsequent messages", async () => {
	const error = new Error("Failed to process messages")
	const handleMessages = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined)
	const onError = vi.fn()
	const enqueue = createMessageDebouncer(handleMessages, onError)
	const ctx = message(1, 1)

	enqueue(ctx)
	await vi.advanceTimersByTimeAsync(2500)

	expect(onError).toHaveBeenCalledWith(error, ctx)

	enqueue(ctx)
	await vi.advanceTimersByTimeAsync(2500)

	expect(handleMessages).toHaveBeenCalledTimes(2)
})
