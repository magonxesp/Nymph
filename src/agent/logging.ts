/**
 * Nymph
 * Copyright (C) 2026  MagonxESP
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { BaseCallbackHandler } from "@langchain/core/callbacks/base"
import type { LLMResult } from "@langchain/core/outputs"
import { z } from "zod"
import { log } from "../logging.js"

interface ModelUsage {
	usage_metadata: {
		input_tokens: number
		output_tokens: number
		total_tokens: number
		input_token_details?: { cache_read?: number }
		output_token_details?: { reasoning?: number }
	}
	response_metadata?: { model_name?: string }
}

const tokenCountSchema = z.number().int().nonnegative()
const modelUsageSchema: z.ZodType<ModelUsage> = z.object({
	usage_metadata: z.object({
		input_tokens: tokenCountSchema,
		output_tokens: tokenCountSchema,
		total_tokens: tokenCountSchema,
		input_token_details: z.object({ cache_read: tokenCountSchema.optional() }).optional(),
		output_token_details: z.object({ reasoning: tokenCountSchema.optional() }).optional()
	}),
	response_metadata: z.object({ model_name: z.string().optional() }).optional()
})

function getReasoning(content: unknown): string[] {
	if (!Array.isArray(content)) {
		return []
	}

	return content.flatMap((block: unknown) => {
		if (typeof block !== "object" || block === null) {
			return []
		}

		const isReasoning = "type" in block && block.type === "reasoning"
		const reasoning = "reasoning" in block ? block.reasoning : undefined

		if (isReasoning && typeof reasoning === "string" && reasoning.trim()) {
			return [reasoning]
		}

		return []
	})
}

export class PinoLangChainHandler extends BaseCallbackHandler {
	name = "pino_langchain"

	constructor(private readonly chatId: number) {
		super()
	}

	handleChatModelStart(_model: unknown, _messages: unknown, runId: string): void {
		log.debug({ chatId: this.chatId, runId }, "LangChain model started")
	}

	handleLLMEnd(output: LLMResult, runId: string): void {
		for (const generation of output.generations.flat()) {
			if (!("message" in generation)) {
				continue
			}

			const message: unknown = generation.message
			const modelUsage = modelUsageSchema.safeParse(message)

			if (modelUsage.success) {
				log.info(
					{
						chatId: this.chatId,
						runId,
						model: modelUsage.data.response_metadata?.model_name,
						usage: modelUsage.data.usage_metadata
					},
					"LangChain model token usage"
				)
			}

			if (typeof message !== "object" || message === null || !("content" in message)) {
				continue
			}

			for (const reasoning of getReasoning(message.content)) {
				log.debug({ chatId: this.chatId, runId, reasoning }, "LangChain model reasoning")
			}
		}

		log.debug({ chatId: this.chatId, runId }, "LangChain model finished")
	}

	handleLLMError(err: Error, runId: string): void {
		log.error({ error: err, chatId: this.chatId, runId }, "LangChain model failed")
	}

	handleToolStart(
		_tool: unknown,
		input: string,
		runId: string,
		_parentRunId?: string,
		_tags?: string[],
		_metadata?: Record<string, unknown>,
		runName?: string
	): void {
		log.debug({ chatId: this.chatId, runId, tool: runName, input }, "LangChain tool started")
	}

	handleToolEnd(_output: unknown, runId: string): void {
		log.debug({ chatId: this.chatId, runId }, "LangChain tool finished")
	}

	handleToolError(err: Error, runId: string): void {
		log.error({ error: err, chatId: this.chatId, runId }, "LangChain tool failed")
	}

	handleChainError(err: Error, runId: string): void {
		log.error({ error: err, chatId: this.chatId, runId }, "LangChain chain failed")
	}
}
