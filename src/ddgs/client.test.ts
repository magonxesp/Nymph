import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DdgsClient } from "./client.js"
import { log } from "../logging.js"

vi.mock("../logging.js", () => ({ log: { warn: vi.fn() } }))
vi.mock("../env.js", () => ({ ddgsBaseUrl: "http://127.0.0.1:8001", ddgsBackend: "auto" }))
const request = vi.fn<typeof fetch>()

beforeEach(() => {
	vi.clearAllMocks()
	request.mockReset()
	vi.stubGlobal("fetch", request)
	request.mockResolvedValue(Response.json({ results: [] }))
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("DdgsClient", () => {
	it("posts a bounded search to the configured REST API and normalizes results", async () => {
		request.mockResolvedValueOnce(
			Response.json({ results: [{ title: "Source", href: "https://example.com/", body: "Text" }] })
		)
		await expect(new DdgsClient().search("short query")).resolves.toEqual([
			{ title: "Source", url: "https://example.com/", snippet: "Text" }
		])
		expect(request).toHaveBeenCalledWith(
			new URL("http://127.0.0.1:8001/search/text"),
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query: "short query", max_results: 5, backend: "auto" }),
				signal: expect.any(AbortSignal)
			})
		)
	})

	it.each(["http://ddgs:8000/api", "http://ddgs:8000/api/"])("preserves a base URL prefix: %s", async (baseUrl) => {
		await new DdgsClient(baseUrl).search("query")
		expect(request).toHaveBeenCalledWith(new URL("http://ddgs:8000/api/search/text"), expect.anything())
	})

	it("caps result count and text lengths", async () => {
		request.mockResolvedValueOnce(
			Response.json({
				results: Array.from({ length: 7 }, () => ({
					title: "x".repeat(300),
					href: "https://example.com/",
					body: "y".repeat(800)
				}))
			})
		)
		const results = await new DdgsClient().search("query")
		expect(results).toHaveLength(5)
		expect(results[0].title).toHaveLength(200)
		expect(results[0].snippet).toHaveLength(400)
	})

	it("keeps usable results when another result has a malformed URL", async () => {
		request.mockResolvedValueOnce(
			Response.json({
				results: [
					{ title: "First", href: "https://example.com/first", body: "First text" },
					{ title: "Broken", href: "not a URL", body: "Broken text" },
					{ title: "Second", href: "https://example.com/second", body: "Second text" }
				]
			})
		)
		await expect(new DdgsClient().search("query")).resolves.toEqual([
			{ title: "First", url: "https://example.com/first", snippet: "First text" },
			{ title: "Second", url: "https://example.com/second", snippet: "Second text" }
		])
		expect(log.warn).toHaveBeenCalledWith(
			{ rejectedResults: 1, resultIndexes: [1] },
			"Discarding invalid DDGS search results"
		)
	})

	it("filters invalid entries before applying the result limit", async () => {
		request.mockResolvedValueOnce(
			Response.json({
				results: [
					null,
					{ title: "Missing body", href: "https://example.com/" },
					...Array.from({ length: 6 }, (_, index) => ({
						title: `Source ${index}`,
						href: `https://example.com/${index}`,
						body: "Text"
					}))
				]
			})
		)
		const results = await new DdgsClient().search("query")
		expect(results).toHaveLength(5)
		expect(results[4].url).toBe("https://example.com/4")
		expect(log.warn).toHaveBeenCalledWith({ rejectedResults: 2, resultIndexes: [0, 1] }, expect.any(String))
	})

	it("trims surrounding URL whitespace without allowing non-web protocols", async () => {
		request.mockResolvedValueOnce(
			Response.json({
				results: [
					{ title: "Source", href: " https://example.com/ \n", body: "Text" },
					{ title: "Email", href: "mailto:info@example.com", body: "Text" },
					{ title: "Script", href: "javascript:alert(1)", body: "Text" }
				]
			})
		)
		await expect(new DdgsClient().search("query")).resolves.toEqual([
			{ title: "Source", url: "https://example.com/", snippet: "Text" }
		])
	})

	it("does not mistake an entirely malformed result set for a successful empty search", async () => {
		request.mockResolvedValueOnce(Response.json({ results: [{ title: "Broken", href: "", body: "Text" }] }))
		await expect(new DdgsClient().search("query")).rejects.toThrow("DDGS returned no valid search results")
	})

	it("excludes video platforms while preserving text sources", async () => {
		request.mockResolvedValueOnce(
			Response.json({
				results: [
					{ title: "Video", href: "https://www.youtube.com/watch?v=123", body: "Video" },
					{ title: "Article", href: "https://example.com/article", body: "Text" },
					{ title: "Another video", href: "https://vimeo.com/123", body: "Video" }
				]
			})
		)
		await expect(new DdgsClient().search("query")).resolves.toEqual([
			{ title: "Article", url: "https://example.com/article", snippet: "Text" }
		])
		expect(log.warn).not.toHaveBeenCalled()
	})

	it("returns no usable results without failing when only video platforms remain", async () => {
		request.mockResolvedValueOnce(
			Response.json({
				results: [
					{ title: "Video", href: "https://youtu.be/123", body: "Video" },
					{ title: "Broken", href: "not a URL", body: "Invalid" }
				]
			})
		)
		await expect(new DdgsClient().search("query")).resolves.toEqual([])
	})

	it("applies the five-result limit after filtering video platforms", async () => {
		request.mockResolvedValueOnce(
			Response.json({
				results: [
					{ title: "Video", href: "https://youtube.com/watch?v=123", body: "Video" },
					...Array.from({ length: 6 }, (_, index) => ({
						title: `Source ${index}`,
						href: `https://example.com/${index}`,
						body: "Text"
					}))
				]
			})
		)
		const results = await new DdgsClient().search("query")
		expect(results).toHaveLength(5)
		expect(results[4].url).toBe("https://example.com/4")
	})

	it("keeps empty results distinct from failures", async () => {
		await expect(new DdgsClient().search("query")).resolves.toEqual([])
	})

	it.each([400, 429, 500])("reports HTTP %s without retrying or exposing server response bodies", async (status) => {
		request.mockResolvedValueOnce(new Response("Internal detail", { status }))
		await expect(new DdgsClient().search("query")).rejects.toThrow(`DDGS search failed with HTTP ${status}`)
		expect(request).toHaveBeenCalledOnce()
	})

	it.each([
		{ results: "invalid" },
		{ results: [{ title: "Bad", href: "javascript:alert(1)", body: "Text" }] },
		{ results: [{ title: "Source", href: "https://example.com/" }] }
	])("validates external responses", async (data) => {
		request.mockResolvedValueOnce(Response.json(data))
		await expect(new DdgsClient().search("query")).rejects.toThrow()
	})

	it("propagates cancellation to fetch", async () => {
		const controller = new AbortController()
		controller.abort()
		request.mockImplementation(async (_url, options) => {
			options?.signal?.throwIfAborted()
			return Response.json({ results: [] })
		})
		await expect(new DdgsClient(undefined, controller.signal).search("query")).rejects.toThrow()
	})

	it("times out slow requests", async () => {
		const controller = new AbortController()
		const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal)
		try {
			request.mockImplementation(
				async (_url, options) =>
					new Promise((_resolve, reject) => {
						options?.signal?.addEventListener("abort", () => reject(options.signal?.reason))
					})
			)
			const pending = expect(new DdgsClient().search("query")).rejects.toThrow("Search timed out")
			controller.abort(new DOMException("Search timed out", "TimeoutError"))
			await pending
			expect(timeout).toHaveBeenCalledWith(15_000)
		} finally {
			timeout.mockRestore()
		}
	})
})
