import { z } from "zod"

export const browserUrlSchema = z
	.string()
	.regex(/^https?:\/\/\S+$/)
	.refine((url) => URL.canParse(url), "Invalid browser URL")
	.describe("URL HTTP o HTTPS de una página descubierta durante la navegación")
