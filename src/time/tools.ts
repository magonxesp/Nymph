import { tool } from "langchain"
import { z } from "zod"

export const getCurrentDate = tool(() => new Date().toISOString(), {
	name: "get_current_date",
	description:
		"Consulta la fecha y hora actuales en UTC. Devuelve un timestamp ISO 8601. Úsala para saber qué día es hoy o interpretar referencias temporales como ayer o mañana.",
	schema: z.object({})
})
