import { FakeListChatModel } from "@langchain/core/utils/testing"
import { createAgent } from "langchain"
import { AIMessage } from "@langchain/core/messages"
import { describe, expect, it, vi } from "vitest"
import { log } from "../logging.js"
import { PinoLangChainHandler } from "./logging.js"

vi.mock("../logging.js", () => ({
	log: { debug: vi.fn(), info: vi.fn(), error: vi.fn() }
}))

describe("PinoLangChainHandler", () => {
	it("receives agent names from LangChain for concurrent model runs", async () => {
		vi.clearAllMocks()
		const handler = new PinoLangChainHandler(123)
		const names = ["private_chat", "group_chat", "memory", "browser"]

		await Promise.all(
			names.map(async (name) => {
				const agent = createAgent({
					name,
					model: new FakeListChatModel({ responses: ["Response"] }),
					tools: []
				})
				await agent.invoke({ messages: [{ role: "user", content: "Hello" }] }, { callbacks: [handler] })
			})
		)

		for (const agent of names) {
			expect(log.debug).toHaveBeenCalledWith(
				expect.objectContaining({ agent, chatId: 123 }),
				"LangChain model finished"
			)
		}
	})

	it("keeps token usage associated with its agent when runs finish out of order", () => {
		vi.clearAllMocks()
		const handler = new PinoLangChainHandler(123)
		const usage = { input_tokens: 10, output_tokens: 2, total_tokens: 12 }
		const output = {
			generations: [
				[{ text: "Response", message: new AIMessage({ content: "Response", usage_metadata: usage }) }]
			]
		}
		handler.handleChatModelStart({}, [], "chat-run", undefined, undefined, undefined, {
			lc_agent_name: "private_chat"
		})
		handler.handleChatModelStart({}, [], "memory-run", undefined, undefined, undefined, { lc_agent_name: "memory" })

		handler.handleLLMEnd(output, "memory-run")
		handler.handleLLMEnd(output, "chat-run")

		expect(log.info).toHaveBeenNthCalledWith(
			1,
			{ chatId: 123, runId: "memory-run", agent: "memory", model: undefined, usage },
			"LangChain model token usage"
		)
		expect(log.info).toHaveBeenNthCalledWith(
			2,
			{ chatId: 123, runId: "chat-run", agent: "private_chat", model: undefined, usage },
			"LangChain model token usage"
		)

		handler.handleLLMEnd(output, "memory-run")
		expect(log.info).toHaveBeenLastCalledWith(
			{ chatId: 123, runId: "memory-run", model: undefined, usage },
			"LangChain model token usage"
		)
	})

	it("logs the agent on failure and clears its run association", () => {
		vi.clearAllMocks()
		const handler = new PinoLangChainHandler(123)
		const error = new Error("Failed")
		handler.handleChatModelStart({}, [], "run", undefined, undefined, undefined, { lc_agent_name: "browser" })
		handler.handleLLMError(error, "run")
		expect(log.error).toHaveBeenCalledWith(
			{ error, chatId: 123, runId: "run", agent: "browser" },
			"LangChain model failed"
		)
		handler.handleLLMEnd({ generations: [] }, "run")
		expect(log.debug).toHaveBeenLastCalledWith({ chatId: 123, runId: "run" }, "LangChain model finished")
	})

	it("logs provider token usage for every inference with its model, chat and run", () => {
		vi.clearAllMocks()
		const handler = new PinoLangChainHandler(123)
		const usage = {
			input_tokens: 100,
			output_tokens: 40,
			total_tokens: 140,
			input_token_details: { cache_read: 50 },
			output_token_details: { reasoning: 20 }
		}
		const message = new AIMessage({
			content: "Response",
			usage_metadata: usage,
			response_metadata: { model_name: "test-model" }
		})

		const generations = [[{ text: "Response", message }]]

		handler.handleLLMEnd({ generations }, "run-usage")

		expect(log.info).toHaveBeenCalledExactlyOnceWith(
			{ chatId: 123, runId: "run-usage", model: "test-model", usage },
			"LangChain model token usage"
		)
	})

	it("logs zero usage without requiring optional token details or a model", () => {
		vi.clearAllMocks()
		const handler = new PinoLangChainHandler(123)
		const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
		const message = new AIMessage({ content: "", usage_metadata: usage })

		const generations = [[{ text: "", message }]]

		handler.handleLLMEnd({ generations }, "run-zero")

		expect(log.info).toHaveBeenCalledExactlyOnceWith(
			{ chatId: 123, runId: "run-zero", model: undefined, usage },
			"LangChain model token usage"
		)
	})

	it("skips absent or invalid usage rather than reporting zero tokens", () => {
		vi.clearAllMocks()
		const handler = new PinoLangChainHandler(123)
		const generations = [
			[
				{ text: "", message: new AIMessage("") },
				{ text: "", message: { usage_metadata: { input_tokens: "10", output_tokens: 2, total_tokens: 12 } } },
				{ text: "", message: { usage_metadata: { input_tokens: -1, output_tokens: 2, total_tokens: 1 } } },
				{ text: "", message: { usage_metadata: { input_tokens: 10 } } }
			]
		]

		handler.handleLLMEnd({ generations }, "run-missing")

		expect(log.info).not.toHaveBeenCalled()
		expect(log.debug).toHaveBeenCalledWith({ chatId: 123, runId: "run-missing" }, "LangChain model finished")
	})

	it("logs reasoning summaries with the chat and run without logging other output", () => {
		vi.clearAllMocks()
		const handler = new PinoLangChainHandler(123)
		const message = new AIMessage({
			content: [
				{
					type: "reasoning",
					reasoning: "Consulto la herramienta antes de responder."
				},
				{ type: "reasoning", reasoning: "Compruebo el resultado." },
				{ type: "text", text: "Respuesta privada" }
			],
			additional_kwargs: { reasoning: { encrypted_content: "encrypted" } }
		})

		const generations = [[{ text: "Respuesta privada", message }]]

		handler.handleLLMEnd({ generations }, "run-1")

		expect(log.debug).toHaveBeenCalledTimes(3)
		expect(log.debug).toHaveBeenNthCalledWith(
			1,
			{
				chatId: 123,
				runId: "run-1",
				reasoning: "Consulto la herramienta antes de responder."
			},
			"LangChain model reasoning"
		)
		expect(log.debug).toHaveBeenNthCalledWith(
			2,
			{
				chatId: 123,
				runId: "run-1",
				reasoning: "Compruebo el resultado."
			},
			"LangChain model reasoning"
		)
		expect(log.debug).toHaveBeenNthCalledWith(
			3,
			{
				chatId: 123,
				runId: "run-1"
			},
			"LangChain model finished"
		)
	})

	it("finishes normally when reasoning is absent, empty or malformed", () => {
		vi.clearAllMocks()
		const handler = new PinoLangChainHandler(123)

		const generations = [
			[
				{ text: "Plain generation" },
				{
					text: "Plain message",
					message: new AIMessage("Plain message")
				},
				{
					text: "",
					message: {
						content: [
							null,
							{ type: "reasoning", reasoning: 42 },
							{ type: "reasoning", reasoning: "   " },
							{ type: "text", reasoning: "Not a reasoning block" }
						]
					}
				}
			]
		]

		handler.handleLLMEnd({ generations }, "run-2")

		expect(log.debug).toHaveBeenCalledExactlyOnceWith(
			{
				chatId: 123,
				runId: "run-2"
			},
			"LangChain model finished"
		)
	})
})
