import { ChatPlatform } from "./platform.js"
import { UserId } from "./user-id.js"
import { describe, expect, it } from "vitest"
import type { GroupMessage } from "./group.js"
import { prepareGroupReplies } from "./group-response.js"

const history: GroupMessage[] = [
	{
		id: "message:alpha",
		role: "user",
		senderId: "user:ana",
		senderName: "Ana",
		text: "Hola",
		timestamp: 1
	}
]

describe("group reply preparation", () => {
	it("resolves participants and opaque message IDs without platform formatting", () => {
		expect(
			prepareGroupReplies(
				{
					messages: [
						{
							text: "Hola",
							media: [],
							replyToMessageId: "message:alpha",
							mentionUserIds: ["user:ana", "user:ana"]
						}
					]
				},
				history,
				ChatPlatform.Telegram
			)
		).toEqual([
			{
				text: "Hola",
				media: [],
				replyToMessageId: "message:alpha",
				mentions: [{ text: "Ana", userId: new UserId("user:ana", "Ana", ChatPlatform.Telegram) }]
			}
		])
	})

	it("validates every reply before returning the batch", () => {
		expect(() =>
			prepareGroupReplies(
				{
					messages: [
						{ text: "Hola", media: [], replyToMessageId: null, mentionUserIds: [] },
						{ text: "Otra cosa", media: [], replyToMessageId: "missing", mentionUserIds: [] }
					]
				},
				history,
				ChatPlatform.Telegram
			)
		).toThrow("outside the group history")
	})
})
