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

import { ChatId } from "./id.js"
import { ChatPlatform } from "./platform.js"
import { getPrivateChatHistory } from "./chat.js"
import type { ChatMessage } from "./chat.js"
import { getGroupChatHistory } from "./group.js"
import type { GroupMessage } from "./group.js"
import type { ChatHistorySnapshot } from "./history.js"
import type { ChatType } from "./type.js"

export type ChatReference = {
	id: string
	platform: ChatPlatform
	type: ChatType
}

export function getChatHistorySnapshot(chat: ChatReference): ChatHistorySnapshot<ChatMessage | GroupMessage> {
	const chatId = new ChatId(chat.id, chat.platform)

	switch (chat.type) {
		case "private":
			return getPrivateChatHistory(chatId).snapshot
		case "group":
			return getGroupChatHistory(chatId).snapshot
	}
}
