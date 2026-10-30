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

import type { Message, User } from "grammy/types"
import { toUserId } from "./user-id.js"
import type { GroupMessage } from "../chat/group.js"

export type GroupMessageContext = {
	message: Message
	me: Pick<User, "id" | "first_name" | "last_name">
}

export type GroupMessageOptions = Partial<Pick<GroupMessage, "text" | "images" | "files" | "mentions">> & {
	message?: Message
}

export function createGroupMessage(
	ctx: GroupMessageContext,
	role: GroupMessage["role"],
	options: GroupMessageOptions = {}
): GroupMessage {
	const message = options.message ?? ctx.message
	const sender = role === "assistant" ? ctx.me : message.from
	const senderChat = role === "user" ? message.sender_chat : undefined
	const text = options.text ?? message.text ?? message.caption
	const mentionEntities = message.text ? message.entities : message.caption_entities
	const { images, files } = options

	const mapSenderId = (): string => {
		if (senderChat) {
			return String(senderChat.id)
		}

		return String(sender?.id ?? "unknown")
	}

	const mapSenderName = (): string => {
		if (role === "assistant") {
			return ctx.me.first_name
		}

		if (senderChat?.title !== undefined) {
			return senderChat.title
		}

		if (sender) {
			return [sender.first_name, sender.last_name].filter(Boolean).join(" ")
		}

		return "Desconocido"
	}

	const mapText = (): string => {
		if (text !== undefined) {
			return text
		}

		if (images?.length) {
			return "[imagen sin texto]"
		}

		if (files?.length) {
			return "[archivo sin texto]"
		}

		return "[mensaje sin texto]"
	}

	const mapMentions = (): GroupMessage["mentions"] => {
		return (
			options.mentions ??
			(mentionEntities ?? [])
				.filter((entity) => entity.type === "mention" || entity.type === "text_mention")
				.map((entity) => ({
					text: (text ?? "").slice(entity.offset, entity.offset + entity.length),
					userId: entity.type === "text_mention" ? toUserId(entity.user) : null
				}))
		)
	}

	return {
		id: String(message.message_id),
		role,
		senderId: mapSenderId(),
		senderName: mapSenderName(),
		text: mapText(),
		images,
		files,
		timestamp: message.date,
		replyToMessageId: message.reply_to_message ? String(message.reply_to_message.message_id) : undefined,
		mentions: mapMentions()
	}
}
