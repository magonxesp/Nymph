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

import type { MessageEntity } from "grammy/types"
import { groupResponseSchema } from "../chat/group.js"
import type { GroupMention, GroupMessage, GroupResponse } from "../chat/group.js"

export function prepareGroupReplies(value: unknown, history: GroupMessage[]) {
	const response = groupResponseSchema.parse(value)

	return response.messages.map((message) => prepareGroupReply(message, history))
}

function prepareGroupReply(response: GroupResponse["messages"][number], history: GroupMessage[]) {
	if (!response.text.trim() && response.media.length === 0) {
		throw new Error("The model returned an empty group answer")
	}

	const replyToMessageId = response.replyToMessageId
	const hasUnknownReply = replyToMessageId !== null && !history.some((message) => message.id === replyToMessageId)

	if (hasUnknownReply) {
		throw new Error("The model selected a message outside the group history")
	}

	const entities: MessageEntity[] = []
	const mentions: GroupMention[] = []
	let text = ""

	for (const userId of new Set(response.mentionUserIds)) {
		const participant = history.findLast((message) => message.senderId === userId)

		if (!participant || !/^[1-9]\d*$/.test(userId)) {
			throw new Error("The model selected an unknown group user")
		}

		const name = participant.senderName.trim() || userId
		entities.push({
			type: "text_link",
			offset: text.length,
			length: name.length,
			url: `tg://user?id=${userId}`
		})
		mentions.push({ text: name, userId })
		text += `${name} `
	}

	text += response.text

	return {
		text,
		media: response.media,
		entities,
		mentions,
		replyToMessageId: replyToMessageId ?? undefined
	}
}
