import { describe, expect, it, vi } from "vitest"
import { ChatId } from "../chat/id.js"
import { TaskCreator } from "./create.js"
import { TaskQueue } from "./queue.js"
import { CachedTaskRepository, InMemoryTaskRepository } from "./repository.js"

const chatId = ChatId.forTelegram("123")
const otherChatId = ChatId.forTelegram("456")

describe("TaskCreator and TaskQueue", () => {
	it("persists tasks with generated UUIDs and queues them in FIFO order per chat", async () => {
		const persistent = new InMemoryTaskRepository()
		const repository = new CachedTaskRepository(persistent)
		const queue = new TaskQueue()
		const creator = new TaskCreator(repository, queue)
		const first = await creator.create("First", chatId, "10")
		const other = await creator.create("Other", otherChatId, "20")
		const second = await creator.create("Second", chatId, "10")

		expect(first.taskId.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
		expect(first.taskId.value).not.toBe(second.taskId.value)
		expect(first).toMatchObject({
			id: "1",
			requesterId: "10",
			status: "queued",
			prompt: "First",
			agent: null,
			embeddings: null
		})
		expect(await repository.find(chatId, first.taskId)).toEqual(first)
		expect(await persistent.find(chatId, first.taskId)).toEqual(first)
		expect(queue.dequeue(chatId)).toEqual(first)
		expect(queue.dequeue(chatId)).toEqual(second)
		expect(queue.dequeue(chatId)).toBeUndefined()
		expect(queue.dequeue(otherChatId)).toEqual(other)
	})

	it("queues only after persistence succeeds", async () => {
		const repository = new CachedTaskRepository(new InMemoryTaskRepository())
		const queue = new TaskQueue()
		const creator = new TaskCreator(repository, queue)
		let finish: () => void = () => {}
		vi.spyOn(repository, "insert").mockImplementation(
			(task) =>
				new Promise((resolve) => {
					finish = () => resolve(task.withPersistence("1", task.createdAt, task.updatedAt))
				})
		)
		const pending = creator.create("Work", chatId, "10")
		expect(queue.dequeue(chatId)).toBeUndefined()
		finish()
		const saved = await pending
		expect(queue.dequeue(chatId)).toEqual(saved)
		vi.mocked(repository.insert).mockRejectedValueOnce(new Error("database error"))
		await expect(creator.create("Work", chatId, "10")).rejects.toThrow("database error")
		expect(queue.dequeue(chatId)).toBeUndefined()
	})
})
