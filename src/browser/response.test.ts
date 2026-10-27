import { describe, expect, it } from "vitest"
import { toJsonSchema } from "@langchain/core/utils/json_schema"
import { browserResponseSchema } from "./response.js"

describe("browser schemas", () => {
	it("exports source URLs as patterns without the unsupported URI format", () => {
		const responseSchema = toJsonSchema(browserResponseSchema)
		const expectedUrl = {
			type: "string",
			pattern: "^https?:\\/\\/\\S+$",
			description: expect.any(String)
		}

		expect(responseSchema).toHaveProperty("properties.sources.items.properties.url", expectedUrl)
	})

	it.each(["https://example.com/article?q=test", "http://example.com/"])("accepts a web source: %s", (url) => {
		const response = { status: "found", answer: "Answer", sources: [{ title: "Source", url }] }

		expect(browserResponseSchema.parse(response)).toEqual(response)
	})

	it.each(["not a URL", "https://", "https://[invalid", "javascript:alert(1)", "file:///tmp/page.html"])(
		"rejects an invalid web source: %s",
		(url) => {
			const response = { status: "found", answer: "Answer", sources: [{ title: "Source", url }] }

			expect(() => browserResponseSchema.parse(response)).toThrow()
		}
	)
})
