import { randomUUID } from "node:crypto"
import type { ChatId } from "../chat/id.js"
import { CachedTaskRepository, type TaskRepository } from "./repository.js"
import { TaskQueue } from "./queue.js"
import { Task } from "./task.js"

export class TaskCreator {
	public constructor(
		private readonly repository: TaskRepository,
		private readonly queue: TaskQueue
	) {}

	public async create(prompt: string, chatId: ChatId, userId: string): Promise<Task> {
		const now = new Date()
		const task = new Task({
			id: null,
			taskId: randomUUID(),
			chatId: chatId.value,
			platform: chatId.platform,
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
		const savedTask = await this.repository.insert(task)
		this.queue.enqueue(savedTask)
		return savedTask
	}
}

export const taskQueue = new TaskQueue()
export const taskRepository = new CachedTaskRepository()
const taskCreator = new TaskCreator(taskRepository, taskQueue)

export function createTask(prompt: string, chatId: ChatId, userId: string): Promise<Task> {
	return taskCreator.create(prompt, chatId, userId)
}
