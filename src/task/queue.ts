import type { ChatId } from "../chat/id.js"
import type { Task } from "./task.js"

export class TaskQueue {
	private readonly queues = new Map<string, Task[]>()

	public enqueue(task: Task): void {
		const key = task.chatId.toMapKey()
		const queue = this.queues.get(key) ?? []
		queue.push(task)
		this.queues.set(key, queue)
	}

	public dequeue(chatId: ChatId): Task | undefined {
		const key = chatId.toMapKey()
		const queue = this.queues.get(key)
		if (queue === undefined) {
			return undefined
		}
		const task = queue.shift()
		if (queue.length === 0) {
			this.queues.delete(key)
		}
		return task
	}
}
