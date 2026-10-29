import { z } from "zod"
import { ChatId } from "../chat/id.js"
import { ChatPlatform } from "../chat/platform.js"
import { Embedding } from "../memory/embedding.js"

export type TaskResult = string | number | boolean | null | TaskResult[] | { [key: string]: TaskResult }

export type TaskData = {
	id: string | null
	taskId: string
	chatId: string
	platform: ChatPlatform
	requesterId: string
	status: string
	prompt: string
	agent: string | null
	result: TaskResult
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
	public readonly requesterId: string
	public readonly status: string
	public readonly prompt: string
	public readonly agent: string | null
	public readonly result: TaskResult
	public readonly error: string | null
	public readonly embeddings: Embedding | null
	public readonly createdAt: Date
	public readonly updatedAt: Date

	public constructor(data: TaskData) {
		if (data.id !== null && !/^[1-9][0-9]*$/.test(data.id)) {
			throw new Error("The task database ID must be a positive integer")
		}
		for (const value of [data.requesterId, data.status, data.prompt]) {
			if (value.trim().length === 0) {
				throw new Error("Task fields must not be blank")
			}
		}
		if (data.agent !== null && data.agent.trim().length === 0) {
			throw new Error("The task agent must not be blank")
		}
		this.id = data.id
		this.taskId = new TaskId(data.taskId)
		this.chatId = new ChatId(data.chatId, data.platform)
		this.requesterId = data.requesterId
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

	public withPersistence(id: string, createdAt: Date, updatedAt: Date): Task {
		return new Task({
			id,
			taskId: this.taskId.value,
			chatId: this.chatId.value,
			platform: this.chatId.platform,
			requesterId: this.requesterId,
			status: this.status,
			prompt: this.prompt,
			agent: this.agent,
			result: this.result,
			error: this.error,
			embeddings: this.embeddings === null ? null : [...this.embeddings.value],
			createdAt,
			updatedAt
		})
	}
}
