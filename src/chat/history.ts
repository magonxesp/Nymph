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

import { EventEmitter } from "node:events"
import type { ChatId } from "./id.js"

export type ChatHistorySnapshot<Message> = {
	chatId: ChatId
	messages: Message[]
	lastMessageSequence: number
}

export abstract class ChatHistory<Message> extends EventEmitter<{
	snapshot: [snapshot: ChatHistorySnapshot<Message>]
}> {
	private readonly _messages: Message[] = []
	private messageSequence = 0
	private lastSnapshotMessageSequence = 0

	protected constructor(
		public readonly chatId: ChatId,
		private readonly messageCountLimit: number
	) {
		super()
	}

	public addMessage(message: Message): void {
		this._messages.push(message)
		this.messageSequence++

		if (this._messages.length > this.messageCountLimit) {
			this._messages.splice(0, this._messages.length - this.messageCountLimit)
		}

		const newMessageCount = this.messageSequence - this.lastSnapshotMessageSequence

		if (newMessageCount >= this.messageCountLimit) {
			const snapshot = this.snapshot

			this.lastSnapshotMessageSequence = this.messageSequence
			this.emit("snapshot", snapshot)
		}
	}

	// Clone mutable message data to isolate snapshots from history. Each implementation
	// preserves its domain classes because structuredClone discards custom prototypes.
	protected abstract cloneMessage(message: Message): Message

	public get snapshot(): ChatHistorySnapshot<Message> {
		return {
			chatId: this.chatId,
			messages: this._messages.map((message) => this.cloneMessage(message)),
			lastMessageSequence: this.messageSequence
		}
	}

	public get messagesCount(): number {
		return this._messages.length
	}

	public get messages(): Message[] {
		return this._messages.slice()
	}
}
