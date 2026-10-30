import { Task } from "./task.js"
import { createTaskAgent } from "../agent/agent.js"
import { PinoLangChainHandler } from "../agent/logging.js"
import { taskRepository } from "./repository.js"
import { log } from "../logging.js"
import { getPrivateChatHistory } from "../chat/chat.js"
import { getGroupChatHistory } from "../chat/group.js"
import { ChatId } from "../chat/id.js"
import { ChatType } from "../chat/type.js"
import { createMessageSender } from "../messaging/factory.js"
import { privateResponseSchema } from "../chat/response.js"
import { taskAgentName } from "../agent/task.js"

export async function invokeTaskAgent(task: Task) {
	const agent = await createTaskAgent()
	const messages = [{ role: "user", content: task.prompt }]

	return await agent.invoke(
		{ messages },
		{
			callbacks: [new PinoLangChainHandler(task.chatId.value)],
			configurable: {
				requesterId: task.requesterId,
				chat: {
					id: task.chatId.value,
					platform: task.chatId.platform,
					type: task.chatType
				}
			}
		}
	)
}

async function sendResult(chatId: ChatId, chatType: ChatType, result: unknown) {
	const answer = privateResponseSchema.parse(result)
	const sender = createMessageSender(chatId)

	for await (const sent of sender.send(answer)) {
		log.trace({ sent, chatId }, "Sent assistant message")
		if (chatType === "private") {
			const history = getPrivateChatHistory(chatId)
			await history.addAssistantMessage(sent.message.text, sent.isText ? undefined : sent.message.text)
		}

		if (chatType === "group") {
			const history = getGroupChatHistory(chatId)
			await history.addAssistantMessage(sent.message, sent.isText ? undefined : sent.message.text)
		}
	}
}

export async function runDelegatedTask(task: Task): Promise<void> {
	try {
		await taskRepository.update(task.running(taskAgentName))

		return invokeTaskAgent(task)
			.then((response) => {
				const result = response.structuredResponse

				void taskRepository.update(task.success(result)).catch((error) => {
					log.warn({ error }, "Update task error")
				})

				log.debug({ result }, "Task agent finished")
				return sendResult(task.chatId, task.chatType, result)
			})
			.catch((error) => {
				void taskRepository.update(task.failure(error)).catch((error) => {
					log.warn({ error }, "Update task error")
				})

				log.warn({ error }, "Task agent failed")
			})
	} catch (error) {
		log.warn({ error }, "Update task error")
	}
}
