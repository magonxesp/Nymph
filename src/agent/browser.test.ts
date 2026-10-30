import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { PinoLangChainHandler } from "./logging.js"
import { createAgent } from "langchain"
import { browseInternet, createBrowserAgent } from "./browser.js"
import { BrowserSession } from "../browser/session.js"
import { log } from "../logging.js"

vi.mock("../logging.js", () => {
	const logger = { child: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
	logger.child.mockReturnValue(logger)
	return { log: logger }
})

const { invoke, close, sources } = vi.hoisted(() => ({
	invoke: vi.fn(),
	close: vi.fn(),
	sources: new Map<string, { title: string; url: string }>()
}))

vi.mock("langchain", async (importOriginal) => {
	const original = await importOriginal<typeof import("langchain")>()
	return { ...original, createAgent: vi.fn(() => ({ invoke })) }
})
vi.mock("../browser/session.js", () => ({
	BrowserSession: class {
		id = "test-browser-session"
		sources = sources
		close = close
		getTools = async () => [
			{ name: "browser_navigate", inputSchema: { type: "object", properties: {} } },
			{ name: "browser_click", inputSchema: { type: "object", properties: {} } }
		]
	}
}))
vi.mock("../env.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("../env.js")>()),
	openAIApiKey: "test-key"
}))

const source = { title: "A verified source", url: "https://example.com/article" }

beforeEach(() => {
	vi.clearAllMocks()
	sources.clear()
	close.mockResolvedValue(undefined)
	invoke.mockResolvedValue({ structuredResponse: { status: "found", answer: "Answer", sources: [source] } })
})

afterEach(() => {
	vi.useRealTimers()
})

describe("browser agent", () => {
	it("loads the browser skill and exposes the MCP navigation tools", async () => {
		await createBrowserAgent(new BrowserSession())
		expect(createAgent).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "browser",
				tools: [
					expect.objectContaining({ name: "ddgs_search_text" }),
					expect.objectContaining({ name: "browser_navigate" }),
					expect.objectContaining({ name: "browser_click" })
				],
				systemPrompt: expect.stringContaining("# Navegación por internet")
			})
		)
	})

	it("returns a concise result backed by a page actually read and always cleans up", async () => {
		sources.set(source.url, source)
		const callbacks = [new PinoLangChainHandler(123)]
		await expect(browseInternet("Find the answer", { callbacks })).resolves.toEqual({
			status: "found",
			answer: "Answer",
			sources: [source]
		})
		expect(invoke).toHaveBeenCalledWith(
			{ messages: [{ role: "user", content: "Find the answer" }] },
			expect.objectContaining({ recursionLimit: 24, callbacks })
		)
		expect(close).toHaveBeenCalledOnce()
		expect(log.info).toHaveBeenCalledWith(
			expect.objectContaining({ status: "found", sources: [source], visitedSources: 1 }),
			"Browser research completed"
		)
	})

	it("rejects fabricated citations and stops without retrying", async () => {
		const response = await browseInternet("Find the answer")
		expect(response.status).toBe("not_found")
		expect(response.sources).toEqual([])
		expect(log.warn).toHaveBeenCalledWith(
			{ rejectedUrls: [source.url] },
			"Browser research rejected unvisited sources"
		)
		expect(invoke).toHaveBeenCalledOnce()
		expect(close).toHaveBeenCalledOnce()
	})

	it("reports empty results explicitly and discards any sources", async () => {
		invoke.mockResolvedValue({ structuredResponse: { status: "not_found", answer: "Nothing", sources: [source] } })
		const response = await browseInternet("Find the answer")
		expect(response.status).toBe("not_found")
		expect(response.answer).toContain("No he podido encontrar")
		expect(response.sources).toEqual([])
	})

	it("reports unavailable navigation and malformed agent responses without throwing", async () => {
		invoke.mockRejectedValueOnce(new Error("Browser unavailable"))
		expect((await browseInternet("Find the answer")).status).toBe("unavailable")
		invoke.mockResolvedValueOnce({ structuredResponse: { answer: "Malformed" } })
		expect((await browseInternet("Find the answer")).status).toBe("unavailable")
		expect(close).toHaveBeenCalledTimes(2)
	})

	it("aborts the model and closes Chromium after sixty seconds", async () => {
		vi.useFakeTimers()
		invoke.mockImplementation(async (_input: unknown, config: { signal: AbortSignal }) => {
			return new Promise((_resolve, reject) => {
				config.signal.addEventListener("abort", () => reject(new Error("Aborted")))
			})
		})
		const pending = browseInternet("Find the answer")
		await vi.waitFor(() => expect(invoke).toHaveBeenCalledOnce())
		await vi.advanceTimersByTimeAsync(60_000)
		expect(log.warn).toHaveBeenCalledWith({ durationMs: 60_000 }, "Browser research timed out")
		expect((await pending).status).toBe("unavailable")
		expect(close).toHaveBeenCalled()
	})
})
