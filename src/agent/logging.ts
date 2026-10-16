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
import { log } from "../logging.js"

// Do not log prompts, tool arguments or model output: Telegram messages can contain private data.
export class PinoLangChainHandler extends BaseCallbackHandler {
    name = "pino_langchain"

    constructor(private readonly chatId: number) {
        super()
    }

    handleChatModelStart(_model: unknown, _messages: unknown, runId: string): void {
        log.debug({ chatId: this.chatId, runId }, "LangChain model started")
    }

    handleLLMEnd(_output: unknown, runId: string): void {
        log.debug({ chatId: this.chatId, runId }, "LangChain model finished")
    }

    handleLLMError(err: Error, runId: string): void {
        log.error({ error: err, chatId: this.chatId, runId }, "LangChain model failed")
    }

    handleToolStart(_tool: unknown, input: string, runId: string, _parentRunId?: string, _tags?: string[], _metadata?: Record<string, unknown>, runName?: string): void {
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
