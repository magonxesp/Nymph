import { UserId } from "../chat/user-id.js"
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

import { ChatPlatform } from "../chat/platform.js"
import { describe, expect, it } from "vitest"
import { ChatId } from "../chat/id.js"
import { createMemoryHistory } from "./history.js"

describe("Memory history snapshot", () => {
	it("includes private chat text without binary attachments", () => {
		const context = createMemoryHistory({
			chatId: new ChatId("test", ChatPlatform.Telegram),
			messages: [
				{
					role: "user",
					content: "El proyecto es Nymph.",
					images: ["data:image/png;base64,SECRET"],
					files: [
						{
							filename: "example.pdf",
							mimeType: "application/pdf",
							data: "SECRET"
						}
					]
				}
			],
			lastMessageSequence: 1
		})

		expect(context).toEqual([{ role: "user", text: "El proyecto es Nymph." }])
		expect(JSON.stringify(context)).not.toContain("SECRET")
	})

	it("preserves attribution and reply metadata for shared group memory", () => {
		const mentions = [{ text: "Ana", userId: new UserId("1", "Ana", ChatPlatform.Telegram) }]
		const context = createMemoryHistory({
			chatId: new ChatId("test", ChatPlatform.Telegram),
			messages: [
				{
					id: "5",
					role: "user",
					senderId: "2",
					senderName: "Luis",
					text: "Estoy de acuerdo, Ana.",
					timestamp: 123,
					replyToMessageId: "4",
					mentions,
					images: ["data:image/png;base64,SECRET"]
				}
			],
			lastMessageSequence: 1
		})
		mentions[0].text = "Changed"

		expect(context[0]).toEqual({
			id: "5",
			role: "user",
			senderId: "2",
			senderName: "Luis",
			text: "Estoy de acuerdo, Ana.",
			timestamp: 123,
			replyToMessageId: "4",
			mentions: [{ text: "Ana", userId: new UserId("1", "Ana", ChatPlatform.Telegram) }]
		})
		expect(JSON.stringify(context)).not.toContain("SECRET")
	})
})
