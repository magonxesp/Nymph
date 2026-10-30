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

import type { Context, Filter } from "grammy"

type MessageContext = Filter<Context, "message">

type PendingMessages = {
	contexts: MessageContext[]
	timer: ReturnType<typeof setTimeout>
}

export function createMessageDebouncer(
	handleMessages: (contexts: MessageContext[]) => Promise<void>,
	onError: (error: unknown, ctx: MessageContext) => void
): (ctx: MessageContext) => void {
	const pending = new Map<string, PendingMessages>()

	return (ctx) => {
		const key = JSON.stringify([ctx.chat.id, ctx.message.message_thread_id, ctx.message.business_connection_id])
		const previous = pending.get(key)
		const contexts = previous?.contexts ?? []

		if (previous !== undefined) {
			clearTimeout(previous.timer)
		}

		contexts.push(ctx)

		const timer = setTimeout(() => {
			pending.delete(key)
			void handleMessages(contexts).catch((error: unknown) => {
				onError(error, ctx)
			})
		}, 2500)

		pending.set(key, { contexts, timer })
	}
}
