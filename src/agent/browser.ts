import { readFile } from "node:fs/promises"
import path from "node:path"
import { ChatOpenAI } from "@langchain/openai"
import { createAgent, providerStrategy, tool } from "langchain"
import type { RunnableConfig } from "@langchain/core/runnables"
import { z } from "zod"
import { browserModel, openAIApiKey, promptsDir, skillsDir } from "../env.js"
import { parseSkill } from "./skill.js"
import { BrowserSession } from "../browser/session.js"
import { createBrowserTools } from "../browser/tools.js"
import { browserFailure, browserResponseSchema } from "../browser/response.js"
import type { BrowserResponse } from "../browser/response.js"
import { log } from "../logging.js"

export async function createBrowserAgent(session: BrowserSession) {
	if (!openAIApiKey) {
		throw new Error("NYMPH_OPENAI_API_KEY is required")
	}

	const prompt = await readFile(path.join(promptsDir, "browser.md"), "utf8")
	const skill = parseSkill(await readFile(path.join(skillsDir, "browser", "SKILL.md"), "utf8"))

	return createAgent({
		name: "browser",
		model: new ChatOpenAI({
			apiKey: openAIApiKey,
			model: browserModel,
			useResponsesApi: true,
			reasoning: { effort: "none" },
			verbosity: "low",
			modelKwargs: { parallel_tool_calls: false },
			maxTokens: 800,
			maxRetries: 0,
			timeout: 20_000
		}),
		tools: await createBrowserTools(session),
		systemPrompt: `${prompt}\n\n${skill.content}`,
		responseFormat: providerStrategy({ schema: browserResponseSchema, strict: true })
	})
}

export async function browseInternet(task: string, config?: RunnableConfig): Promise<BrowserResponse> {
	const controller = new AbortController()
	const session = new BrowserSession(controller.signal)
	const browserLog = log.child({ browserSessionId: session.id, model: browserModel })
	const startedAt = Date.now()
	browserLog.info({ taskChars: task.length }, "Browser research started")
	const timeout = setTimeout(() => {
		browserLog.warn({ durationMs: Date.now() - startedAt }, "Browser research timed out")
		controller.abort()
		void session.close().catch(() => {})
	}, 60_000)

	try {
		const agent = await createBrowserAgent(session)
		const result = await agent.invoke(
			{ messages: [{ role: "user", content: task }] },
			{
				callbacks: config?.callbacks,
				recursionLimit: 24,
				signal: controller.signal
			}
		)
		const response = browserResponseSchema.parse(result.structuredResponse)
		if (response.status !== "found") {
			browserLog.info(
				{ status: response.status, visitedSources: session.sources.size, durationMs: Date.now() - startedAt },
				"Browser research finished without an answer"
			)
			return browserFailure(response.status)
		}

		const sources = response.sources.filter((source) => session.sources.has(source.url))
		if (sources.length !== response.sources.length) {
			browserLog.warn(
				{
					rejectedUrls: response.sources
						.filter((source) => !session.sources.has(source.url))
						.map((source) => source.url)
				},
				"Browser research rejected unvisited sources"
			)
		}
		if (sources.length === 0) {
			browserLog.warn({ visitedSources: session.sources.size }, "Browser research has no verified sources")
			return browserFailure("not_found")
		}

		browserLog.info(
			{ status: "found", sources, visitedSources: session.sources.size, durationMs: Date.now() - startedAt },
			"Browser research completed"
		)
		return { ...response, sources }
	} catch (error) {
		browserLog.warn(
			{ err: error, visitedSources: session.sources.size, durationMs: Date.now() - startedAt },
			"Browser research failed"
		)
		return browserFailure("unavailable")
	} finally {
		clearTimeout(timeout)
		await session.close().catch((error: unknown) => browserLog.warn({ err: error }, "Browser cleanup failed"))
	}
}

export const browserResearch = tool(
	async ({ task }, runtime) => browseInternet(task, { callbacks: runtime.callbacks }),
	{
		name: "browser_research",
		description:
			"Delega una búsqueda breve por internet a un agente. Carga la skill browser y llama una sola vez por petición. Devuelve respuesta y fuentes o indica que no encontró información.",
		schema: z.object({ task: z.string().trim().min(1).max(1000) })
	}
)
