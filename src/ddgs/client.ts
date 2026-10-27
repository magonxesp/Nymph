import { z } from "zod"
import { ddgsBackend, ddgsBaseUrl } from "../env.js"
import { browserUrlSchema } from "../browser/url.js"
import { log } from "../logging.js"
import { isVideoUrl } from "./video.js"

interface DdgsResult {
	title: string
	href: string
	body: string
}

interface DdgsResponse {
	results: unknown[]
}

export interface SearchResult {
	title: string
	url: string
	snippet: string
}

const responseSchema: z.ZodType<DdgsResponse> = z.object({
	results: z.array(z.unknown())
})

const resultSchema: z.ZodType<DdgsResult> = z.object({
	title: z.string(),
	href: z.string().trim().pipe(browserUrlSchema),
	body: z.string()
})

export class DdgsClient {
	public constructor(
		private readonly baseUrl: string = ddgsBaseUrl,
		private readonly signal?: AbortSignal
	) {}

	public async search(query: string): Promise<SearchResult[]> {
		const baseUrl = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`
		const endpoint = new URL("search/text", baseUrl)
		const timeout = AbortSignal.timeout(15_000)

		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query, max_results: 5, backend: ddgsBackend }),
			signal: this.signal ? AbortSignal.any([this.signal, timeout]) : timeout
		})

		if (!response.ok) {
			throw new Error(`DDGS search failed with HTTP ${response.status}`)
		}

		const data: unknown = await response.json()

		const responseData = responseSchema.parse(data)
		const results: SearchResult[] = []
		const rejectedIndexes: number[] = []

		for (const [index, candidate] of responseData.results.entries()) {
			const parsed = resultSchema.safeParse(candidate)
			if (!parsed.success) {
				rejectedIndexes.push(index)
				continue
			}

			const entry = parsed.data
			if (isVideoUrl(entry.href)) {
				log.debug({ url: entry.href, title: entry.title }, "DDGS Search result ignored")
				continue
			}

			results.push({ title: entry.title.slice(0, 200), url: entry.href, snippet: entry.body.slice(0, 400) })
			log.debug({ url: entry.href, title: entry.title }, "DDGS Search result")

			if (results.length === 5) {
				break
			}
		}

		if (rejectedIndexes.length > 0) {
			log.warn(
				{ rejectedResults: rejectedIndexes.length, resultIndexes: rejectedIndexes },
				"Discarding invalid DDGS search results"
			)
		}

		const hasOnlyInvalidResults =
			responseData.results.length > 0 && rejectedIndexes.length === responseData.results.length
		if (hasOnlyInvalidResults) {
			throw new Error("DDGS returned no valid search results")
		}

		return results
	}
}
