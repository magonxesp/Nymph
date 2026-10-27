import { z } from "zod"
import type { BrowserSource } from "./session.js"
import { browserUrlSchema } from "./url.js"

export interface BrowserResponse {
	status: "found" | "not_found" | "unavailable"
	answer: string
	sources: BrowserSource[]
}

export const browserResponseSchema: z.ZodType<BrowserResponse> = z
	.object({
		status: z.enum(["found", "not_found", "unavailable"]),
		answer: z.string().min(1).max(2000),
		sources: z.array(z.object({ title: z.string().max(200), url: browserUrlSchema }).strict()).max(3)
	})
	.strict()

export function browserFailure(status: "not_found" | "unavailable"): BrowserResponse {
	return {
		status,
		answer:
			status === "not_found"
				? "No he podido encontrar la información solicitada por internet con una búsqueda breve."
				: "No he podido buscar la información por internet porque la navegación no está disponible o se ha agotado el tiempo.",
		sources: []
	}
}
