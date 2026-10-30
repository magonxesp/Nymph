import { describe, expect, it } from "vitest"
import { ChatId } from "../chat/id.js"
import { ChatPlatform } from "../chat/platform.js"
import { UserId } from "../chat/user-id.js"
import { Task } from "./task.js"

describe("task requester identity", () => {
	it("preserves the requester through serialization and status changes", () => {
		const requester = new UserId("42", "Ana García", ChatPlatform.Telegram)
		const task = Task.create(new ChatId("123", ChatPlatform.Telegram), requester, "Investiga", "group")
		const restored = new Task(task.toPlainObject()).running("research").success({ text: "Resultado" })

		expect(restored.requesterId).toBeInstanceOf(UserId)
		expect(restored.requesterId).toEqual(requester)
		expect(restored.toPlainObject().requesterId).toEqual({ value: "42", name: "Ana García", platform: "telegram" })
	})
})
