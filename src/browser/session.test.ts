import { beforeEach, describe, expect, it, vi } from "vitest"
import serverModule = require("@modelcontextprotocol/sdk/server/index.js")
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { createConnection } from "@playwright/mcp"
import { BrowserSession } from "./session.js"
import { createBrowserTools } from "./tools.js"
import { access, writeFile } from "node:fs/promises"
import path from "node:path"
import { log } from "../logging.js"

const { Server } = serverModule

const { launch, closeBrowser, execute, ddgsSearch } = vi.hoisted(() => ({
	launch: vi.fn(),
	closeBrowser: vi.fn(),
	execute: vi.fn(),
	ddgsSearch: vi.fn()
}))

vi.mock("@playwright/mcp", () => ({ createConnection: vi.fn() }))
vi.mock("../ddgs/client.js", () => ({
	DdgsClient: class {
		search = ddgsSearch
	}
}))
vi.mock("playwright", () => ({ chromium: { launch } }))
vi.mock("../logging.js", () => {
	const logger = { child: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
	logger.child.mockReturnValue(logger)
	return { log: logger }
})

const page = { url: vi.fn(() => "https://example.com/article"), title: async () => "Verified page" }
const context = { pages: () => [page] }
const snapshot =
	"### Page\n- Page URL: https://example.com/article\n### Snapshot\n```yaml\n- paragraph: Verified information\n```"

beforeEach(() => {
	vi.clearAllMocks()
	ddgsSearch.mockResolvedValue([])
	page.url.mockReturnValue("https://example.com/article")
	launch.mockResolvedValue({ newContext: async () => context, close: closeBrowser })
	execute.mockResolvedValue({ content: [{ type: "text", text: snapshot }] })
	vi.mocked(createConnection).mockImplementation(async (_config, getContext) => {
		const server = new Server({ name: "test-playwright", version: "1.0.0" }, { capabilities: { tools: {} } })
		server.setRequestHandler(ListToolsRequestSchema, async () => ({
			tools: ["browser_navigate", "browser_click", "browser_snapshot", "browser_run_code_unsafe"].map((name) => ({
				name,
				description: name,
				inputSchema: { type: "object", properties: { url: { type: "string" } } }
			}))
		}))
		server.setRequestHandler(CallToolRequestSchema, async (request) => {
			await getContext?.()
			return execute(request.params)
		})
		return server
	})
})

describe("Playwright MCP session", () => {
	it("discovers MCP tools and forwards a LangChain invocation over the MCP transport", async () => {
		const session = new BrowserSession()
		try {
			const tools = await createBrowserTools(session)
			expect(tools.map((entry) => entry.name)).toEqual([
				"ddgs_search_text",
				"browser_navigate",
				"browser_click",
				"browser_snapshot"
			])
			await expect(tools[1].invoke({ url: page.url() })).resolves.toBe(snapshot)
			expect(execute).toHaveBeenCalledWith({ name: "browser_navigate", arguments: { url: page.url() } })
			expect(session.sources.get(page.url())).toEqual({ title: "Verified page", url: page.url() })
			expect(log.child).toHaveBeenCalledWith({ browserSessionId: session.id })
			expect(log.info).toHaveBeenCalledWith(
				expect.objectContaining({ pageUrl: page.url(), snapshotReceived: true, sourceRecorded: true }),
				"Browser MCP tool completed"
			)
		} finally {
			await session.close()
		}
		expect(closeBrowser).toHaveBeenCalledOnce()
	})

	it("opens a search result through the MCP click tool before recording a source", async () => {
		const session = new BrowserSession()
		const searchUrl = "https://html.duckduckgo.com/html/?q=documentation"
		try {
			await session.getTools()
			execute.mockResolvedValueOnce({
				content: [
					{
						type: "text",
						text: `### Page\n- Page URL: ${searchUrl}\n### Snapshot\n\`\`\`yaml\n- link "Documentation" [ref=e12]:\n  - /url: ${page.url()}\n\`\`\``
					}
				]
			})
			page.url.mockReturnValue(searchUrl)
			const search = await session.callTool("browser_navigate", { url: searchUrl })
			expect(search).toContain("browser_click")
			expect(session.sources.size).toBe(0)
			page.url.mockReturnValue("https://example.com/article")
			await session.callTool("browser_click", { target: "e12" })
			expect(execute).toHaveBeenLastCalledWith({ name: "browser_click", arguments: { target: "e12" } })
			expect(session.sources.has(page.url())).toBe(true)
		} finally {
			await session.close()
		}
	})

	it.each([403, 429, 500])("reports HTTP %s even if MCP does not flag the response as an error", async (status) => {
		const session = new BrowserSession()
		try {
			await session.getTools()
			execute.mockResolvedValueOnce({
				content: [
					{ type: "text", text: snapshot.replace("### Snapshot", `- HTTP status: ${status}\n### Snapshot`) }
				]
			})
			expect(await session.callTool("browser_navigate", { url: page.url() })).toContain("Error de navegación")
			expect(session.sources.size).toBe(0)
		} finally {
			await session.close()
		}
	})

	it("stops on a blocked DuckDuckGo page without treating support links as results", async () => {
		const session = new BrowserSession()
		try {
			await session.getTools()
			execute.mockResolvedValueOnce({
				content: [
					{
						type: "text",
						text: '### Page\n- Page URL: https://html.duckduckgo.com/html/?q=test\n- HTTP status: 403\n### Snapshot\n```yaml\n- link "email us" [ref=e2]\n```'
					}
				]
			})
			const result = await session.callTool("browser_navigate", {
				url: "https://html.duckduckgo.com/html/?q=test"
			})
			expect(result).toContain("Devuelve unavailable")
			expect(session.sources.size).toBe(0)
			expect(execute).toHaveBeenCalledOnce()
		} finally {
			await session.close()
		}
	})

	it("allows two API queries and does not count snippets as verified sources", async () => {
		const session = new BrowserSession()
		try {
			const tools = await createBrowserTools(session)
			ddgsSearch.mockResolvedValue([{ title: "Result", url: page.url(), snippet: "Text" }])
			const result = JSON.parse(await tools[0].invoke({ query: "short query" }))
			expect(result.status).toBe("ok")
			expect(result.results).toHaveLength(1)
			expect(session.sources.size).toBe(0)
			expect(launch).not.toHaveBeenCalled()
			await session.search("second query")
			expect(JSON.parse(await session.search("third query")).status).toBe("limit")
			expect(ddgsSearch).toHaveBeenCalledTimes(2)
		} finally {
			await session.close()
		}
	})

	it("shares the action budget between search and MCP tools", async () => {
		const session = new BrowserSession()
		try {
			await session.getTools()
			await session.search("query")
			for (let index = 0; index < 9; index += 1) {
				await session.callTool("browser_snapshot", {})
			}
			expect(JSON.parse(await session.search("second query")).status).toBe("limit")
			expect(ddgsSearch).toHaveBeenCalledOnce()
		} finally {
			await session.close()
		}
	})

	it("reports search failures without retrying or opening a search engine", async () => {
		const session = new BrowserSession()
		try {
			ddgsSearch.mockRejectedValueOnce(new Error("API quota exceeded"))
			const result = JSON.parse(await session.search("query"))
			expect(result.status).toBe("unavailable")
			expect(result.message).toContain("NYMPH_DDGS_BASE_URL")
			expect(ddgsSearch).toHaveBeenCalledOnce()
			expect(execute).not.toHaveBeenCalled()
		} finally {
			await session.close()
		}
	})

	it("does not record failed tools or URLs that do not match a browser page", async () => {
		const session = new BrowserSession()
		try {
			await session.getTools()
			execute.mockResolvedValueOnce({ isError: true, content: [{ type: "text", text: snapshot }] })
			await expect(session.callTool("browser_navigate", { url: page.url() })).resolves.toContain("Error")
			expect(log.warn).toHaveBeenCalledWith(
				expect.objectContaining({ mcpError: snapshot, sourceRecorded: false }),
				"Browser MCP tool returned an error"
			)
			execute.mockResolvedValueOnce({
				content: [{ type: "text", text: snapshot.replace(page.url(), "https://invented.example/") }]
			})
			await session.callTool("browser_snapshot", {})
			expect(session.sources.size).toBe(0)
		} finally {
			await session.close()
		}
	})

	it("inlines MCP snapshot files and removes the session output on cleanup", async () => {
		const session = new BrowserSession()
		let outputDir: string | undefined
		try {
			await session.getTools()
			outputDir = vi.mocked(createConnection).mock.calls[0][0]?.outputDir
			if (!outputDir) {
				throw new Error("Missing MCP output directory")
			}
			const filename = path.join(outputDir, "page.yml")
			await writeFile(filename, '- link "Verified link" [ref=e1]\n' + "x".repeat(20_000))
			execute.mockResolvedValueOnce({
				content: [
					{
						type: "text",
						text: `### Page\n- Page URL: ${page.url()}\n### Snapshot\n- [Snapshot](${filename})`
					}
				]
			})

			const result = await session.callTool("browser_navigate", { url: page.url() })
			expect(result).toContain('- link "Verified link" [ref=e1]')
			expect(result).not.toContain("[Snapshot]")
			expect(result.length).toBeLessThanOrEqual(12_000)
		} finally {
			await session.close()
		}
		if (outputDir) {
			await expect(access(outputDir)).rejects.toThrow()
		}
	})

	it("rejects snapshot file links outside the session", async () => {
		const session = new BrowserSession()
		try {
			await session.getTools()
			execute.mockResolvedValueOnce({
				content: [{ type: "text", text: "### Snapshot\n- [Snapshot](/tmp/other.yml)" }]
			})
			await expect(session.callTool("browser_snapshot", {})).rejects.toThrow("fuera de la sesión")
		} finally {
			await session.close()
		}
	})

	it("bounds actions and rejects tools outside the navigation set", async () => {
		const session = new BrowserSession()
		try {
			await session.getTools()
			await expect(session.callTool("browser_run_code_unsafe", {})).rejects.toThrow("no disponible")
			for (let index = 0; index < 10; index += 1) {
				await session.callTool("browser_snapshot", {})
			}
			await expect(session.callTool("browser_snapshot", {})).resolves.toContain("Límite")
			expect(execute).toHaveBeenCalledTimes(10)
		} finally {
			await session.close()
		}
	})

	it("closes idempotently and rejects calls after cleanup or cancellation", async () => {
		const controller = new AbortController()
		const session = new BrowserSession(controller.signal)
		await session.getTools()
		controller.abort()
		await expect(session.callTool("browser_snapshot", {})).rejects.toThrow("tiempo agotado")
		await session.close()
		await session.close()
		await expect(session.getTools()).rejects.toThrow("cerrada")
		expect(execute).not.toHaveBeenCalled()
	})

	it("cleans up a failed MCP connection", async () => {
		vi.mocked(createConnection).mockRejectedValueOnce(new Error("MCP unavailable"))
		const session = new BrowserSession()
		await expect(session.getTools()).rejects.toThrow("MCP unavailable")
		await expect(session.close()).resolves.toBeUndefined()
	})

	it("logs transport failures with the original error and rethrows them", async () => {
		const error = new Error("Transport disconnected")
		execute.mockRejectedValueOnce(error)
		const session = new BrowserSession()
		try {
			await session.getTools()
			await expect(session.callTool("browser_snapshot", {})).rejects.toThrow("Transport disconnected")
			expect(log.warn).toHaveBeenCalledWith(
				expect.objectContaining({ err: expect.any(Error), durationMs: expect.any(Number) }),
				"Browser MCP tool failed"
			)
		} finally {
			await session.close()
		}
	})
})
