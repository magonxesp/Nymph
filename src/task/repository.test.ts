import { UserId } from "../chat/user-id.js"
import { ChatPlatform } from "../chat/platform.js"
import { readFile } from "node:fs/promises"
import { afterAll, describe, expect, it, vi } from "vitest"
import { ChatId } from "../chat/id.js"
import { database } from "../database.js"
import { Embedding } from "../memory/embedding.js"
import {
	CachedTaskRepository,
	InMemoryTaskRepository,
	PostgresTaskRepository,
	type TaskRepository
} from "./repository.js"
import { Task, TaskId } from "./task.js"

const taskId = new TaskId("4bde8b43-4e8a-4e5b-a058-b5b2de3ef986")
const chatId = new ChatId("123", ChatPlatform.Telegram)
const input = new Task({
	id: null,
	taskId: taskId.value,
	chatId: chatId.value,
	platform: chatId.platform,
	chatType: "private",
	requesterId: new UserId("456", "Ana", ChatPlatform.Telegram),
	status: "queued",
	prompt: "Do work",
	agent: "browser",
	result: null,
	error: null,
	embeddings: [1, 0],
	createdAt: new Date(),
	updatedAt: new Date()
})
const task = input.withPersistence("1", input.createdAt, input.updatedAt)

function mockRepository(): TaskRepository {
	return {
		find: vi.fn().mockResolvedValue(task),
		listByStatus: vi.fn().mockResolvedValue([]),
		insert: vi.fn().mockResolvedValue(task),
		update: vi.fn().mockResolvedValue(task),
		search: vi.fn().mockResolvedValue([])
	}
}

describe("CachedTaskRepository", () => {
	it("lists from persistent storage even when the cache contains only some tasks", async () => {
		const persistent = mockRepository()
		vi.mocked(persistent.listByStatus).mockResolvedValue([task])
		const repository = new CachedTaskRepository(persistent)
		expect(await repository.listByStatus(chatId, "queued")).toEqual([task])
		expect(persistent.listByStatus).toHaveBeenCalledWith(chatId, "queued")
	})
	it("loads once from postgres and isolates cached tasks by chat", async () => {
		const persistent = mockRepository()
		const repository = new CachedTaskRepository(persistent)
		expect(await repository.find(chatId, taskId)).toEqual(task)
		expect(await repository.find(chatId, taskId)).toEqual(task)
		expect(persistent.find).toHaveBeenCalledTimes(1)
		const memory = new InMemoryTaskRepository()
		memory.save(task)
		expect(await memory.find(new ChatId("other", ChatPlatform.Telegram), taskId)).toBeUndefined()
	})

	it("updates the cache only after successful writes and evicts missing updates", async () => {
		const persistent = mockRepository()
		const repository = new CachedTaskRepository(persistent)
		await repository.insert(input)
		expect(await repository.find(chatId, taskId)).toEqual(task)
		vi.mocked(persistent.update).mockRejectedValueOnce(new Error("database error")).mockResolvedValueOnce(undefined)
		await expect(repository.update(input)).rejects.toThrow("database error")
		expect(await repository.find(chatId, taskId)).toEqual(task)
		await repository.update(input)
		await repository.find(chatId, taskId)
		expect(persistent.find).toHaveBeenCalledTimes(1)
	})

	it("serializes a cache miss and a concurrent update", async () => {
		const persistent = mockRepository()
		let release: (value: Task) => void = () => {}
		vi.mocked(persistent.find).mockReturnValueOnce(
			new Promise((resolve) => {
				release = resolve
			})
		)
		const updated = new Task({ ...taskData(), status: "completed" })
		vi.mocked(persistent.update).mockResolvedValue(updated)
		const repository = new CachedTaskRepository(persistent)
		const read = repository.find(chatId, taskId)
		await Promise.resolve()
		const write = repository.update(input)
		release(task)
		await Promise.all([read, write])
		expect(await repository.find(chatId, taskId)).toEqual(updated)
	})
})

it("supports standalone in-memory task operations", async () => {
	const repository = new InMemoryTaskRepository()
	const created = await repository.insert(input)
	expect(created.requesterId).toBeInstanceOf(UserId)
	expect(created.requesterId).toEqual(input.requesterId)
	expect(created.chatType).toBe("private")
	expect(created.toPlainObject().chatType).toBe("private")
	await expect(repository.insert(input)).rejects.toThrow("already exists")
	expect(await repository.find(chatId, taskId)).toEqual(created)
	expect((await repository.search(chatId, new Embedding([1, 0])))[0].distance).toBe(0)
	expect(await repository.search(new ChatId("other", ChatPlatform.Telegram), new Embedding([1, 0]))).toEqual([])
	expect((await repository.update(new Task({ ...taskData(), status: "completed" })))?.status).toBe("completed")
})

it("lists only tasks in the requested chat and status", async () => {
	const repository = new InMemoryTaskRepository()
	const queued = await repository.insert(input)
	await repository.insert(
		new Task({ ...input.toPlainObject(), taskId: "4bde8b43-4e8a-4e5b-a058-b5b2de3ef987", status: "completed" })
	)
	await repository.insert(
		new Task({ ...input.toPlainObject(), taskId: "4bde8b43-4e8a-4e5b-a058-b5b2de3ef988", chatId: "other" })
	)
	expect(await repository.listByStatus(chatId, "queued")).toEqual([queued])
	expect(await repository.listByStatus(chatId, "failed")).toEqual([])
})

function taskData() {
	return {
		id: "1",
		taskId: taskId.value,
		chatId: chatId.value,
		platform: chatId.platform,
		chatType: "private" as const,
		requesterId: input.requesterId,
		status: input.status,
		prompt: input.prompt,
		agent: input.agent,
		result: null,
		error: null,
		embeddings: [1, 0],
		createdAt: new Date(),
		updatedAt: new Date()
	}
}

describe.runIf(process.env.NYMPH_TEST_POSTGRES === "1")("PostgresTaskRepository integration", () => {
	afterAll(async () => database.destroy())

	it("stores, searches, updates and isolates tasks, rejecting duplicate UUIDs", async () => {
		await database.transaction(async (connection) => {
			const sql = await readFile(new URL("../../sql/squema.sql", import.meta.url), "utf8")
			await connection.raw(
				sql
					.replace("CREATE TABLE IF NOT EXISTS tasks", "CREATE TEMP TABLE tasks")
					.replace("CREATE TABLE IF NOT EXISTS chat_memories", "CREATE TEMP TABLE chat_memories")
			)
			const repository = new PostgresTaskRepository(connection)
			const created = await repository.insert(input)
			expect(created.requesterId).toBeInstanceOf(UserId)
			expect(created.requesterId).toEqual(input.requesterId)
			expect(created.chatType).toBe("private")
			expect(await connection("tasks").select("chat_type").where("task_id", taskId.value).first()).toEqual({
				chat_type: "private"
			})
			expect(await repository.listByStatus(chatId, "queued")).toEqual([created])
			expect(await repository.listByStatus(new ChatId("other", ChatPlatform.Telegram), "queued")).toEqual([])
			expect(await repository.listByStatus(chatId, "completed")).toEqual([])
			expect(await repository.find(chatId, taskId)).toEqual(created)
			expect(await repository.find(new ChatId("other", ChatPlatform.Telegram), taskId)).toBeUndefined()
			expect((await repository.search(chatId, input.embeddings!)).map((result) => result.task)).toEqual([created])
			expect(
				(await repository.update(new Task({ ...taskData(), status: "completed", result: { text: "ok" } })))
					?.result
			).toEqual({ text: "ok" })
			await expect(repository.insert(input)).rejects.toThrow("already exists")
			await connection.raw("DROP TABLE pg_temp.tasks")
			await connection.raw("DROP TABLE pg_temp.chat_memories")
		})
	})
})
