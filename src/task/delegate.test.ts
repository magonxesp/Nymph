import { UserId } from "../chat/user-id.js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ChatId } from "../chat/id.js"
import { ChatPlatform } from "../chat/platform.js"
import { InMemoryTaskRepository, taskRepository } from "./repository.js"
import { TaskId } from "./task.js"
import { delegateTask } from "./tools.js"

const mocks = vi.hoisted(() => ({ runDelegatedTask: vi.fn(), error: vi.fn(), warn: vi.fn() }))

vi.mock("./delegate.js", () => ({ runDelegatedTask: mocks.runDelegatedTask }))
vi.mock("../logging.js", () => ({ log: { warn: mocks.warn, error: mocks.error } }))

const chatId = new ChatId("123", ChatPlatform.Telegram)
const config = {
	configurable: {
		chat: { id: chatId.value, platform: chatId.platform, type: "group" },
		requesterId: new UserId("456", "Ana", ChatPlatform.Telegram)
	}
}

afterEach(() => {
	vi.restoreAllMocks()
	vi.clearAllMocks()
})

describe("delegateTask", () => {
	it("persists the task and launches it without waiting for execution", async () => {
		const repository = new InMemoryTaskRepository()
		vi.spyOn(taskRepository, "insert").mockImplementation((task) => repository.insert(task))
		mocks.runDelegatedTask.mockReturnValue(new Promise<void>(() => {}))

		const response = await delegateTask.invoke({ prompt: "Investiga" }, config)

		expect(response).toEqual({ taskId: expect.any(String), status: "queued" })
		if (!("taskId" in response) || typeof response.taskId !== "string") {
			throw new Error("Task was not created")
		}

		const saved = await repository.find(chatId, new TaskId(response.taskId))
		expect(saved).toMatchObject({
			chatType: "group",
			requesterId: new UserId("456", "Ana", ChatPlatform.Telegram),
			prompt: "Investiga",
			status: "queued"
		})
		expect(mocks.runDelegatedTask).toHaveBeenCalledExactlyOnceWith(saved)
	})

	it("does not execute if persistence fails", async () => {
		vi.spyOn(taskRepository, "insert").mockRejectedValue(new Error("Database unavailable"))

		expect(await delegateTask.invoke({ prompt: "Trabajo" }, config)).toHaveProperty("error")
		expect(mocks.runDelegatedTask).not.toHaveBeenCalled()
	})

	it("requires a chat and non-blank requester before persisting", async () => {
		const insert = vi.spyOn(taskRepository, "insert")

		expect(await delegateTask.invoke({ prompt: "Trabajo" })).toHaveProperty("error")
		expect(
			await delegateTask.invoke({ prompt: "Trabajo" }, { configurable: { chat: config.configurable.chat } })
		).toHaveProperty("error")
		expect(
			await delegateTask.invoke(
				{ prompt: "Trabajo" },
				{ configurable: { ...config.configurable, requesterId: " " } }
			)
		).toHaveProperty("error")
		expect(insert).not.toHaveBeenCalled()
		expect(mocks.runDelegatedTask).not.toHaveBeenCalled()
	})

	it("reports a background execution rejection without changing the tool response", async () => {
		const repository = new InMemoryTaskRepository()
		vi.spyOn(taskRepository, "insert").mockImplementation((task) => repository.insert(task))
		mocks.runDelegatedTask.mockRejectedValue(new Error("Execution failed"))

		const response = await delegateTask.invoke({ prompt: "Trabajo" }, config)

		expect(response).toMatchObject({ status: "queued" })
		await vi.waitFor(() => expect(mocks.error).toHaveBeenCalledOnce())
	})
})
