import { BaseCallbackHandler } from "@langchain/core/callbacks/base"
import { log } from "./logging.js"

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
        log.error({ err, chatId: this.chatId, runId }, "LangChain model failed")
    }

    handleToolStart(_tool: unknown, _input: string, runId: string, _parentRunId?: string, _tags?: string[], _metadata?: Record<string, unknown>, runName?: string): void {
        log.debug({ chatId: this.chatId, runId, tool: runName }, "LangChain tool started")
    }

    handleToolEnd(_output: unknown, runId: string): void {
        log.debug({ chatId: this.chatId, runId }, "LangChain tool finished")
    }

    handleToolError(err: Error, runId: string): void {
        log.error({ err, chatId: this.chatId, runId }, "LangChain tool failed")
    }

    handleChainError(err: Error, runId: string): void {
        log.error({ err, chatId: this.chatId, runId }, "LangChain chain failed")
    }
}
