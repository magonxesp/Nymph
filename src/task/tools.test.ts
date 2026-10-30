import { UserId } from "../chat/user-id.js"
import { ChatPlatform } from "../chat/platform.js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ChatId } from "../chat/id.js"
import { taskRepository } from "./repository.js"
import { Task, TaskId } from "./task.js"
import { getTask, listTasks } from "./tools.js"

vi.mock("../logging.js", () => ({ log: { warn: vi.fn() } }))
vi.mock("./delegate.js", () => ({ runDelegatedTask: vi.fn() }))

const chatId = new ChatId("123", ChatPlatform.Telegram)
const id = "4bde8b43-4e8a-4e5b-a058-b5b2de3ef986"
const config = { configurable: { chat: { id: chatId.value, platform: chatId.platform, type: "private" } } }
const task = new Task({
	id: "1",
	taskId: id,
	chatId: chatId.value,
	platform: chatId.platform,
	chatType: "private",
	requesterId: new UserId("456", "Ana", ChatPlatform.Telegram),
	status: "completed",
	prompt: "Investiga",
	agent: null,
	result: { text: "Resultado" },
	error: null,
	embeddings: [1, 0],
	createdAt: new Date("2026-10-29T10:00:00Z"),
	updatedAt: new Date("2026-10-29T11:00:00Z")
})

describe("listTasks", () => {
	it("lists tasks by status for the configured chat without embeddings", async () => {
		const list = vi.spyOn(taskRepository, "listByStatus").mockResolvedValue([task])
		const response = await listTasks.invoke({ status: "completed" }, config)
		expect(response).toEqual({
			tasks: [
				{
					taskId: id,
					chatType: "private",
					requesterId: new UserId("456", "Ana", ChatPlatform.Telegram),
					status: "completed",
					prompt: "Investiga",
					agent: null,
					result: { text: "Resultado" },
					error: null,
					createdAt: "2026-10-29T10:00:00.000Z",
					updatedAt: "2026-10-29T11:00:00.000Z"
				}
			]
		})
		expect(list).toHaveBeenCalledWith(chatId, "completed")
	})

	it("returns an empty list when there are no matching tasks", async () => {
		vi.spyOn(taskRepository, "listByStatus").mockResolvedValue([])
		expect(await listTasks.invoke({ status: "queued" }, config)).toEqual({ tasks: [] })
	})

	it("requires a status and trusted chat context", async () => {
		const list = vi.spyOn(taskRepository, "listByStatus")
		expect(listTasks.schema.safeParse({ status: " " }).success).toBe(false)
		expect(listTasks.schema.safeParse({ status: "done" }).success).toBe(false)
		await expect(listTasks.invoke({ status: "completed", chatId: "other" }, config)).rejects.toThrow()
		expect(await listTasks.invoke({ status: "completed" })).toHaveProperty("error")
		expect(list).not.toHaveBeenCalled()
	})

	it("reports repository failures", async () => {
		vi.spyOn(taskRepository, "listByStatus").mockRejectedValue(new Error("Database unavailable"))
		expect(await listTasks.invoke({ status: "completed" }, config)).toHaveProperty("error")
	})
})

afterEach(() => vi.restoreAllMocks())

describe("getTask", () => {
	it("returns task details without embeddings and uses the configured chat", async () => {
		const find = vi.spyOn(taskRepository, "find").mockResolvedValue(task)
		expect(await getTask.invoke({ taskId: id }, config)).toEqual({
			task: {
				taskId: id,
				chatType: "private",
				requesterId: new UserId("456", "Ana", ChatPlatform.Telegram),
				status: "completed",
				prompt: "Investiga",
				agent: null,
				result: { text: "Resultado" },
				error: null,
				createdAt: "2026-10-29T10:00:00.000Z",
				updatedAt: "2026-10-29T11:00:00.000Z"
			}
		})
		expect(find).toHaveBeenCalledWith(chatId, new TaskId(id))
	})

	it("reports missing tasks without disclosing other chats", async () => {
		vi.spyOn(taskRepository, "find").mockResolvedValue(undefined)
		expect(await getTask.invoke({ taskId: id }, config)).toHaveProperty("error")
	})

	it("rejects extra chat arguments and requires trusted chat context", async () => {
		const find = vi.spyOn(taskRepository, "find")
		await expect(getTask.invoke({ taskId: id, chatId: "other" }, config)).rejects.toThrow()
		expect(await getTask.invoke({ taskId: id })).toHaveProperty("error")
		expect(find).not.toHaveBeenCalled()
	})

	it("reports repository errors", async () => {
		vi.spyOn(taskRepository, "find").mockRejectedValue(new Error("Database unavailable"))
		expect(await getTask.invoke({ taskId: id }, config)).toHaveProperty("error")
	})
})
