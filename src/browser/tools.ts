import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import type { BrowserSession } from "./session.js"

export async function createBrowserTools(session: BrowserSession): Promise<DynamicStructuredTool[]> {
	const definitions = await session.getTools()

	const search = new DynamicStructuredTool({
		name: "ddgs_search_text",
		description:
			"Busca con la API REST de DDGS. Devuelve hasta cinco títulos, URLs y fragmentos breves. Abre las fuentes con browser_navigate antes de responder.",
		schema: z.object({ query: z.string().trim().min(1).max(300) }),
		func: async ({ query }: { query: string }) => session.search(query)
	})

	return [
		search,
		...definitions.map(
			(definition) =>
				new DynamicStructuredTool({
					func: async (args: Record<string, unknown>) => session.callTool(definition.name, args),
					name: definition.name,
					description: definition.description ?? definition.name,
					schema: definition.inputSchema
				})
		)
	]
}
