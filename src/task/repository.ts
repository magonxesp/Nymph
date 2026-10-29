import type { Knex } from "knex"
import pgvector from "pgvector"
import { z } from "zod"
import { ChatPlatform } from "../chat/platform.js"
import type { ChatId } from "../chat/id.js"
import { database } from "../database.js"
import type { Embedding } from "../memory/embedding.js"
import { Task, TaskId } from "./task.js"

export type TaskSearchResult = { task: Task; distance: number }

export interface TaskRepository {
	find(chatId: ChatId, taskId: TaskId): Promise<Task | undefined>
	insert(task: Task): Promise<Task>
	update(task: Task): Promise<Task | undefined>
	search(chatId: ChatId, embedding: Embedding, limit?: number): Promise<TaskSearchResult[]>
}

const rowSchema = z.object({
	id: z.string(),
	task_id: z.string(),
	chat_id: z.string(),
	platform: z.enum(ChatPlatform),
	requester_id: z.string(),
	status: z.string(),
	prompt: z.string(),
	agent: z.string().nullable(),
	result: z.json(),
	error: z.string().nullable(),
	embeddings: z
		.string()
		.nullable()
		.transform((value) => (value === null ? null : pgvector.fromSql(value)))
		.pipe(z.array(z.number()).nullable()),
	created_at: z.date(),
	updated_at: z.date()
})

function toTask(row: unknown): Task {
	const data = rowSchema.parse(row)
	return new Task({
		id: data.id,
		taskId: data.task_id,
		chatId: data.chat_id,
		platform: data.platform,
		requesterId: data.requester_id,
		status: data.status,
		prompt: data.prompt,
		agent: data.agent,
		result: data.result,
		error: data.error,
		embeddings: data.embeddings,
		createdAt: data.created_at,
		updatedAt: data.updated_at
	})
}

function values(task: Task) {
	return {
		requester_id: task.requesterId,
		status: task.status,
		prompt: task.prompt,
		agent: task.agent,
		result: JSON.stringify(task.result),
		error: task.error,
		embeddings: task.embeddings === null ? null : pgvector.toSql([...task.embeddings.value])
	}
}

export class PostgresTaskRepository implements TaskRepository {
	public constructor(private readonly connection: Knex = database) {}

	public async find(chatId: ChatId, taskId: TaskId): Promise<Task | undefined> {
		const row: unknown = await this.connection("tasks")
			.where({ chat_id: chatId.value, platform: chatId.platform, task_id: taskId.value })
			.first()
		return row === undefined ? undefined : toTask(row)
	}

	public async insert(task: Task): Promise<Task> {
		const fields = values(task)
		return this.connection.transaction(async (transaction) => {
			await transaction.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [task.taskId.value])
			const existing: unknown = await transaction("tasks").where({ task_id: task.taskId.value }).first("id")
			if (existing !== undefined) {
				throw new Error("A task with this UUID already exists")
			}
			const rows: unknown[] = await transaction("tasks")
				.insert({
					...fields,
					task_id: task.taskId.value,
					chat_id: task.chatId.value,
					platform: task.chatId.platform
				})
				.returning("*")
			return toTask(rows[0])
		})
	}

	public async update(task: Task): Promise<Task | undefined> {
		const rows: unknown[] = await this.connection("tasks")
			.where({ chat_id: task.chatId.value, platform: task.chatId.platform, task_id: task.taskId.value })
			.update({ ...values(task), updated_at: new Date() })
			.returning("*")
		return rows.length === 0 ? undefined : toTask(rows[0])
	}

	public async search(chatId: ChatId, embedding: Embedding, limit = 5): Promise<TaskSearchResult[]> {
		const validatedLimit = z.number().int().positive().parse(limit)
		const distance = this.connection.raw("?? <=> ?::vector", ["embeddings", pgvector.toSql([...embedding.value])])
		const rows: unknown[] = await this.connection("tasks")
			.select("*", this.connection.raw("? AS distance", [distance]))
			.where({ chat_id: chatId.value, platform: chatId.platform })
			.whereNotNull("embeddings")
			.orderBy(distance, "asc")
			.limit(validatedLimit)
		return rows.map((row) => ({
			task: toTask(row),
			distance: z.object({ distance: z.number() }).parse(row).distance
		}))
	}
}

export class InMemoryTaskRepository implements TaskRepository {
	private readonly tasks = new Map<string, Task>()
	private nextId = 1

	private key(chatId: ChatId, taskId: TaskId): string {
		return JSON.stringify([chatId.platform, chatId.value, taskId.value])
	}

	public async find(chatId: ChatId, taskId: TaskId): Promise<Task | undefined> {
		return this.tasks.get(this.key(chatId, taskId))
	}

	public async insert(task: Task): Promise<Task> {
		if ([...this.tasks.values()].some((existing) => existing.taskId.value === task.taskId.value)) {
			throw new Error("A task with this UUID already exists")
		}
		const now = new Date()
		const savedTask = task.withPersistence(String(this.nextId), now, now)
		this.nextId++
		this.save(savedTask)
		return savedTask
	}

	public async update(task: Task): Promise<Task | undefined> {
		const existing = this.tasks.get(this.key(task.chatId, task.taskId))
		if (existing === undefined) {
			return undefined
		}
		if (existing.id === null) {
			throw new Error("The stored task must have a database ID")
		}
		const savedTask = task.withPersistence(existing.id, existing.createdAt, new Date())
		this.save(savedTask)
		return savedTask
	}

	public async search(chatId: ChatId, embedding: Embedding, limit = 5): Promise<TaskSearchResult[]> {
		const validatedLimit = z.number().int().positive().parse(limit)
		const results: TaskSearchResult[] = []
		for (const task of this.tasks.values()) {
			if (
				task.chatId.value !== chatId.value ||
				task.chatId.platform !== chatId.platform ||
				task.embeddings === null
			) {
				continue
			}
			const vector = task.embeddings.value
			if (vector.length !== embedding.value.length) {
				throw new Error("Embedding dimensions must match")
			}
			const dot = vector.reduce((sum, value, index) => sum + value * embedding.value[index], 0)
			const magnitude = (values: readonly number[]) =>
				Math.sqrt(values.reduce((sum, value) => sum + value * value, 0))
			results.push({ task, distance: 1 - dot / (magnitude(vector) * magnitude(embedding.value)) })
		}
		return results.sort((a, b) => a.distance - b.distance).slice(0, validatedLimit)
	}

	public save(task: Task): void {
		this.tasks.set(this.key(task.chatId, task.taskId), task)
	}

	public delete(chatId: ChatId, taskId: TaskId): void {
		this.tasks.delete(this.key(chatId, taskId))
	}
}

export class CachedTaskRepository implements TaskRepository {
	private readonly pending = new Map<string, Promise<void>>()
	public constructor(
		private readonly persistent: TaskRepository = new PostgresTaskRepository(),
		private readonly memory = new InMemoryTaskRepository()
	) {}

	private async serialize<T>(chatId: ChatId, taskId: TaskId, operation: () => Promise<T>): Promise<T> {
		const key = JSON.stringify([chatId.platform, chatId.value, taskId.value])
		const previous = this.pending.get(key) ?? Promise.resolve()
		const current = previous.then(operation)
		const settled = current.then(
			() => {},
			() => {}
		)
		this.pending.set(key, settled)
		try {
			return await current
		} finally {
			if (this.pending.get(key) === settled) {
				this.pending.delete(key)
			}
		}
	}

	public find(chatId: ChatId, taskId: TaskId): Promise<Task | undefined> {
		return this.serialize(chatId, taskId, async () => {
			const cached = await this.memory.find(chatId, taskId)
			if (cached !== undefined) {
				return cached
			}
			const task = await this.persistent.find(chatId, taskId)
			if (task !== undefined) {
				this.memory.save(task)
			}
			return task
		})
	}

	public insert(task: Task): Promise<Task> {
		return this.serialize(task.chatId, task.taskId, async () => {
			const savedTask = await this.persistent.insert(task)
			this.memory.save(savedTask)
			return savedTask
		})
	}

	public update(task: Task): Promise<Task | undefined> {
		return this.serialize(task.chatId, task.taskId, async () => {
			const savedTask = await this.persistent.update(task)
			if (savedTask === undefined) {
				this.memory.delete(task.chatId, task.taskId)
			} else {
				this.memory.save(savedTask)
			}
			return savedTask
		})
	}

	public search(chatId: ChatId, embedding: Embedding, limit?: number): Promise<TaskSearchResult[]> {
		return this.persistent.search(chatId, embedding, limit)
	}
}
