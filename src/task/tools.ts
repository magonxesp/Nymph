import { tool } from "langchain"
import { z } from "zod"
import { UserId } from "../chat/user-id.js"
import { ChatId } from "../chat/id.js"
import { getConfiguredChat } from "../chat/configuration.js"
import { log } from "../logging.js"
import { taskRepository } from "./repository.js"
import { Task, TaskId } from "./task.js"
import { taskStatusSchema } from "./status.js"
import { runDelegatedTask } from "./delegate.js"

function taskResult(task: Task) {
	return {
		taskId: task.taskId.value,
		chatType: task.chatType,
		requesterId: task.requesterId,
		status: task.status,
		prompt: task.prompt,
		agent: task.agent,
		result: task.result,
		error: task.error,
		createdAt: task.createdAt.toISOString(),
		updatedAt: task.updatedAt.toISOString()
	}
}

export const getTask = tool(
	async ({ taskId }, runtime) => {
		try {
			const chat = getConfiguredChat(runtime)
			const task = await taskRepository.find(new ChatId(chat.id, chat.platform), new TaskId(taskId))

			if (task === undefined) {
				return { error: "No existe una tarea con ese ID en el chat actual." }
			}

			return { task: taskResult(task) }
		} catch (error) {
			log.warn({ error, tool: "get_task" }, "Task tool failed")
			return { error: "No se pudo consultar la tarea." }
		}
	},
	{
		name: "get_task",
		description:
			"Consulta por UUID el estado y resultado de una tarea del chat actual. Usa un UUID conocido, sin inventarlo.",
		schema: z
			.object({
				taskId: z
					.string()
					.regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)
					.describe("UUID de la tarea")
			})
			.strict()
	}
)

export const listTasks = tool(
	async ({ status }, runtime) => {
		try {
			const chat = getConfiguredChat(runtime)
			const tasks = await taskRepository.listByStatus(new ChatId(chat.id, chat.platform), status)
			return { tasks: tasks.map(taskResult) }
		} catch (error) {
			log.warn({ error, tool: "list_tasks" }, "Task tool failed")
			return { error: "No se pudieron consultar las tareas." }
		}
	},
	{
		name: "list_tasks",
		description: "Lista todas las tareas del chat actual que tienen el estado indicado.",
		schema: z.object({ status: taskStatusSchema.describe("Estado exacto de las tareas") }).strict()
	}
)

export const delegateTask = tool(
	async ({ prompt }, runtime) => {
		try {
			const chat = getConfiguredChat(runtime)
			const userId = UserId.fromUnknown(runtime.configurable?.requesterId)

			const task = Task.create(new ChatId(chat.id, chat.platform), userId, prompt, chat.type)
			const saved = await taskRepository.insert(task)

			void runDelegatedTask(saved).catch((error: unknown) => {
				log.error({ error, taskId: saved.taskId.value }, "Delegated task execution failed")
			})

			return { taskId: saved.taskId.value, status: saved.status }
		} catch (error) {
			log.warn({ error, tool: "delegate_task" }, "Task delegation failed")
			return { error: "No se pudo delegar la tarea." }
		}
	},
	{
		name: "delegate_task",
		description:
			"Delega una tarea para ejecutarla en segundo plano y enviar el resultado al chat. Proporciona un encargo autónomo con todo el contexto necesario; el agente no recibe el historial.",
		schema: z.object({ prompt: z.string().trim().min(1).describe("Instrucciones completas de la tarea") }).strict()
	}
)

export const taskTools = [getTask, listTasks, delegateTask]
