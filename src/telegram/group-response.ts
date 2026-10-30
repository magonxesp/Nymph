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

import { prepareGroupReplies as prepareChatGroupReplies } from "../chat/group-response.js"
import type { GroupMessage } from "../chat/group.js"
import { ChatPlatform } from "../chat/platform.js"
import { toTelegramResponse } from "./outgoing-message.js"

export function prepareGroupReplies(value: unknown, history: GroupMessage[]) {
	return prepareChatGroupReplies(value, history, ChatPlatform.Telegram).map(toTelegramResponse)
}
