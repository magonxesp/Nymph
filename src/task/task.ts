import { UserId, type UserIdData } from "../chat/user-id.js"
import { z } from "zod"
import { ChatId } from "../chat/id.js"
import { ChatPlatform } from "../chat/platform.js"
import { Embedding } from "../memory/embedding.js"
import { randomUUID } from "node:crypto"
import type { ChatType } from "../chat/type.js"
import type { TaskStatus } from "./status.js"

export type TaskData = {
	id: string | null
	taskId: string
	chatId: string
	platform: ChatPlatform
	chatType: ChatType
	requesterId: UserIdData
	status: TaskStatus
	prompt: string
	agent: string | null
	result: unknown | null
	error: string | null
	embeddings: number[] | null
	createdAt: Date
	updatedAt: Date
}

export class TaskId {
	public readonly value: string

	public constructor(value: string) {
		this.value = value.toLowerCase()
		this.validate()
	}

	private validate(): void {
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(this.value)) {
			throw new Error("The task ID must be a UUID")
		}
	}
}

export class Task {
	public readonly id: string | null
	public readonly taskId: TaskId
	public readonly chatId: ChatId
	public readonly chatType: ChatType
	public readonly requesterId: UserId
	public readonly status: TaskStatus
	public readonly prompt: string
	public readonly agent: string | null
	public readonly result: unknown | null
	public readonly error: string | null
	public readonly embeddings: Embedding | null
	public readonly createdAt: Date
	public readonly updatedAt: Date

	public constructor(data: TaskData) {
		if (data.id !== null && !/^[1-9][0-9]*$/.test(data.id)) {
			throw new Error("The task database ID must be a positive integer")
		}

		if (data.prompt.trim().length === 0) {
			throw new Error("Task fields must not be blank")
		}

		if (data.agent !== null && data.agent.trim().length === 0) {
			throw new Error("The task agent must not be blank")
		}
		this.id = data.id
		this.taskId = new TaskId(data.taskId)
		this.chatId = new ChatId(data.chatId, data.platform)
		this.chatType = data.chatType
		this.requesterId = new UserId(data.requesterId.value, data.requesterId.name, data.requesterId.platform)
		this.status = data.status
		this.prompt = data.prompt
		this.agent = data.agent
		this.result = z.json().parse(data.result)
		this.error = data.error
		this.embeddings = data.embeddings === null ? null : new Embedding(data.embeddings)
		this.createdAt = new Date(data.createdAt)
		this.updatedAt = new Date(data.updatedAt)
		if (Number.isNaN(this.createdAt.getTime()) || Number.isNaN(this.updatedAt.getTime())) {
			throw new Error("Task dates must be valid")
		}
	}

	public toPlainObject(): TaskData {
		return {
			id: this.id,
			taskId: this.taskId.value,
			chatId: this.chatId.value,
			platform: this.chatId.platform,
			chatType: this.chatType,
			requesterId: {
				value: this.requesterId.value,
				name: this.requesterId.name,
				platform: this.requesterId.platform
			},
			status: this.status,
			prompt: this.prompt,
			agent: this.agent,
			result: this.result,
			error: this.error,
			embeddings: this.embeddings === null ? null : [...this.embeddings.value],
			createdAt: this.createdAt,
			updatedAt: this.updatedAt
		}
	}

	public withPersistence(id: string, createdAt: Date, updatedAt: Date): Task {
		return new Task({ ...this.toPlainObject(), id, createdAt, updatedAt })
	}

	public running(agent: string): Task {
		return new Task({ ...this.toPlainObject(), agent, status: "running", updatedAt: new Date() })
	}

	public success(result: unknown): Task {
		return new Task({ ...this.toPlainObject(), result, status: "completed", updatedAt: new Date() })
	}

	public failure(error: string): Task {
		return new Task({ ...this.toPlainObject(), error, status: "failed", updatedAt: new Date() })
	}

	public static create(chatId: ChatId, userId: UserId, prompt: string, chatType: ChatType): Task {
		const now = new Date()

		return new Task({
			id: null,
			taskId: randomUUID(),
			chatId: chatId.value,
			platform: chatId.platform,
			chatType,
			requesterId: userId,
			status: "queued",
			prompt,
			agent: null,
			result: null,
			error: null,
			embeddings: null,
			createdAt: now,
			updatedAt: now
		})
	}
}
