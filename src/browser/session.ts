import { createConnection } from "@playwright/mcp"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import type { Server } from "@modelcontextprotocol/sdk/server/index.js" with { "resolution-mode": "require" }
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import { chromium } from "playwright"
import type { Browser, BrowserContext } from "playwright"
import { mkdtemp, open, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { DdgsClient } from "../ddgs/client.js"
import { log } from "../logging.js"

export interface BrowserSource {
	title: string
	url: string
}

const allowedTools = new Set([
	"browser_navigate",
	"browser_navigate_back",
	"browser_snapshot",
	"browser_click",
	"browser_type",
	"browser_press_key",
	"browser_wait_for"
])

export class BrowserSession {
	public readonly id = randomUUID()
	private readonly log = log.child({ browserSessionId: this.id })
	private readonly searchClient: DdgsClient
	private readonly client = new Client({ name: "nymph-browser", version: "1.0.0" })
	private server?: Server
	private browser?: Browser
	private context?: BrowserContext
	private browserContext?: Promise<BrowserContext>
	private connection?: Promise<void>
	private closing?: Promise<void>
	private outputDir?: string
	private actions = 0
	private searches = 0
	private readonly deadline = Date.now() + 60_000
	public readonly sources = new Map<string, BrowserSource>()

	public constructor(private readonly signal?: AbortSignal) {
		this.searchClient = new DdgsClient(undefined, signal)
	}

	public async getTools(): Promise<Tool[]> {
		this.ensureAvailable()
		this.connection ??= this.connect()
		await this.connection
		this.ensureAvailable()

		const { tools } = await this.client.listTools({}, { signal: this.signal, timeout: 10_000 })
		const availableTools = tools.filter((definition) => allowedTools.has(definition.name))
		this.log.info({ tools: availableTools.map((definition) => definition.name) }, "Browser MCP tools loaded")
		return availableTools
	}

	public async search(query: string): Promise<string> {
		this.ensureAvailable()
		if (this.actions >= 10 || this.searches >= 2) {
			return JSON.stringify({
				status: "limit",
				message: "Límite de búsqueda alcanzado. Termina la investigación.",
				results: []
			})
		}

		this.actions += 1
		this.searches += 1
		const startedAt = Date.now()
		try {
			const results = await this.searchClient.search(query)
			while (JSON.stringify({ status: "ok", results }).length > 6000) {
				results.pop()
			}
			this.log.info(
				{
					tool: "ddgs_search_text",
					action: this.actions,
					searches: this.searches,
					durationMs: Date.now() - startedAt
				},
				"Browser search completed"
			)
			return JSON.stringify({ status: "ok", results })
		} catch (error) {
			this.log.warn(
				{ err: error, tool: "ddgs_search_text", durationMs: Date.now() - startedAt },
				"Browser search failed"
			)
			return JSON.stringify({
				status: "unavailable",
				message:
					"La búsqueda no está disponible. Revisa el servicio DDGS y NYMPH_DDGS_BASE_URL. No reintentes ni uses un buscador web; devuelve unavailable.",
				results: []
			})
		}
	}

	public async callTool(name: string, args: Record<string, unknown>): Promise<string> {
		this.ensureAvailable()
		if (name === "ddgs_search_text") {
			const { query } = z.object({ query: z.string().trim().min(1).max(300) }).parse(args)
			return this.search(query)
		}

		if (!allowedTools.has(name)) {
			this.log.warn({ tool: name }, "Browser MCP tool rejected")
			throw new Error("Herramienta de navegación no disponible")
		}

		if (this.actions >= 10) {
			this.log.warn({ tool: name, actions: this.actions }, "Browser MCP action limit reached")
			return "Límite de diez acciones alcanzado. Termina la investigación con las fuentes disponibles."
		}

		this.actions += 1
		const startedAt = Date.now()
		const actionLog = this.log.child({ tool: name, action: this.actions })
		actionLog.info(
			{ requestedUrl: args.url, target: args.target, inputKeys: Object.keys(args) },
			"Browser MCP tool started"
		)
		try {
			const rawResult: unknown = await this.client.callTool({ name, arguments: args }, CallToolResultSchema, {
				signal: this.signal,
				timeout: Math.max(1, Math.min(15_000, this.deadline - Date.now()))
			})
			const result = CallToolResultSchema.parse(rawResult)
			const text = result.content.flatMap((content) => (content.type === "text" ? [content.text] : [])).join("\n")
			const output = (await this.inlineSnapshot(text)).slice(0, 12_000)

			const snapshotReceived = output.includes("### Snapshot\n```yaml\n")
			const url = /^- Page URL: (https?:\/\/\S+)$/m.exec(output)?.[1]
			const httpStatus = Number(/^- HTTP status: (\d{3})\b/m.exec(output)?.[1] ?? 200)
			const navigationFailed = Boolean(result.isError) || httpStatus >= 400
			const hostname = url ? new URL(url).hostname : ""
			const isSearchPage = hostname === "duckduckgo.com" || hostname.endsWith(".duckduckgo.com")
			let source: BrowserSource | undefined
			if (!navigationFailed && snapshotReceived && !isSearchPage) {
				const page = this.context?.pages().find((candidate) => candidate.url() === url)
				if (page && url) {
					source = { title: (await page.title()).slice(0, 200), url }
					this.sources.set(url, source)
				}
			}
			const details = {
				durationMs: Date.now() - startedAt,
				pageUrl: url,
				pageTitle: source?.title,
				snapshotReceived,
				httpStatus,
				isSearchPage,
				responseChars: output.length,
				sourceRecorded: Boolean(source),
				visitedSources: this.sources.size
			}
			if (navigationFailed) {
				actionLog.warn({ ...details, mcpError: output }, "Browser MCP tool returned an error")
			} else {
				actionLog.info(details, "Browser MCP tool completed")
			}

			if (navigationFailed) {
				const instruction = isSearchPage
					? "DuckDuckGo no está disponible. Devuelve unavailable; no pulses enlaces de soporte ni intentes sortear el bloqueo."
					: "No se ha podido consultar esta página. No la uses como fuente."
				return `Error de navegación MCP:\n${instruction}\n${output}`.slice(0, 12_000)
			}

			if (isSearchPage) {
				const instruction =
					"Página del buscador, no es una fuente verificada. Si el snapshot contiene resultados útiles, abre el título de uno con browser_click usando su target observado y lee la página de destino antes de responder. No pulses anuncios, ayuda ni enlaces de soporte. Si no hay resultados útiles, reformula una sola vez o termina."
				return `${instruction}\n\n${output}`.slice(0, 12_000)
			}

			return output
		} catch (error) {
			actionLog.warn({ err: error, durationMs: Date.now() - startedAt }, "Browser MCP tool failed")
			throw error
		}
	}

	private async connect(): Promise<void> {
		this.outputDir = await mkdtemp(path.join(tmpdir(), "nymph-browser-"))
		const server = await createConnection(
			{
				// The supplied context is already isolated; MCP must reuse it.
				browser: { browserName: "chromium", isolated: false },
				imageResponses: "omit",
				webmcp: false,
				snapshot: { mode: "full" },
				codegen: "none",
				outputDir: this.outputDir,
				filePaths: "absolute",
				timeouts: { action: 5000, navigation: 10_000 }
			},
			() => this.getBrowserContext()
		)
		this.server = server
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
		await server.connect(serverTransport)
		await this.client.connect(clientTransport)
		this.log.info("Browser MCP connected")
	}

	private async inlineSnapshot(text: string): Promise<string> {
		const snapshotLink = /^- \[Snapshot\]\(([^\n]+)\)$/m.exec(text)
		if (!snapshotLink || !this.outputDir) {
			return text
		}

		const filename = path.resolve(snapshotLink[1])
		if (path.dirname(filename) !== this.outputDir) {
			throw new Error("Snapshot MCP fuera de la sesión de navegación")
		}

		const file = await open(filename, "r")
		try {
			const buffer = Buffer.alloc(12_000)
			const { bytesRead } = await file.read(buffer, 0, buffer.length, 0)
			const snapshot = buffer.subarray(0, bytesRead).toString("utf8")
			return text.replace(snapshotLink[0], () => `\`\`\`yaml\n${snapshot}\n\`\`\``)
		} finally {
			await file.close()
		}
	}

	private getBrowserContext(): Promise<BrowserContext> {
		this.ensureAvailable()
		this.browserContext ??= this.launchBrowser()
		return this.browserContext
	}

	private async launchBrowser(): Promise<BrowserContext> {
		const startedAt = Date.now()
		this.log.info("Browser Chromium starting")
		this.browser = await chromium.launch({ headless: true, timeout: 10_000 })
		this.context = await this.browser.newContext({
			acceptDownloads: false,
			serviceWorkers: "block",
			userAgent:
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
		})
		this.log.info({ durationMs: Date.now() - startedAt }, "Browser Chromium started")
		return this.context
	}

	private ensureAvailable(): void {
		if (this.closing || this.signal?.aborted || Date.now() >= this.deadline) {
			this.log.warn(
				{
					closed: Boolean(this.closing),
					aborted: Boolean(this.signal?.aborted),
					deadlineExceeded: Date.now() >= this.deadline
				},
				"Browser session unavailable"
			)
			throw new Error("Sesión de navegación cerrada o tiempo agotado. Termina la investigación.")
		}
	}

	public close(): Promise<void> {
		this.closing ??= this.dispose()
		return this.closing
	}

	private async dispose(): Promise<void> {
		this.log.debug({ actions: this.actions, visitedSources: this.sources.size }, "Browser session closing")
		await this.connection?.catch(() => {})
		try {
			await this.client.close()
		} finally {
			try {
				await this.server?.close()
			} finally {
				await this.browserContext?.catch(() => {})
				try {
					await this.browser?.close()
				} finally {
					if (this.outputDir) {
						await rm(this.outputDir, { recursive: true, force: true })
					}
					this.log.info(
						{ actions: this.actions, visitedSources: this.sources.size },
						"Browser session closed"
					)
				}
			}
		}
	}
}
