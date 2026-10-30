import { readFile } from "node:fs/promises"
import path from "node:path"
import { ChatOpenAI } from "@langchain/openai"
import { createAgent, providerStrategy } from "langchain"
import { chatModel, openAIApiKey, promptsDir } from "../env.js"
import { behaviorSystemPrompt, skillIndex } from "./context.js"
import { taskAgentTools } from "./tools.js"
import { privateResponseSchema } from "../chat/response.js"

export const taskAgentName = "task"

export async function createTaskAgent() {
	if (!openAIApiKey) {
		throw new Error("NYMPH_OPENAI_API_KEY is required")
	}

	const taskPrompt = await readFile(path.join(promptsDir, "task.md"), "utf8")
	const systemPrompt = [behaviorSystemPrompt, taskPrompt, skillIndex].filter(Boolean).join("\n\n")

	return createAgent({
		name: taskAgentName,
		model: new ChatOpenAI({
			apiKey: openAIApiKey,
			model: chatModel,
			useResponsesApi: true,
			reasoning: { effort: "low", summary: "auto" },
			verbosity: "low"
		}),
		tools: taskAgentTools,
		systemPrompt,
		responseFormat: providerStrategy({
			schema: privateResponseSchema,
			strict: true
		})
	})
}
