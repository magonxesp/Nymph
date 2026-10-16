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

import { readFile } from "node:fs/promises"
import path from "node:path"
import { ChatOpenAI } from "@langchain/openai"
import { openAIApiKey, promptsDir, summaryModel } from "../env.js"
import { getAnswer } from "../agent/response.js"
import type { ChatMessage } from "./chat.js"
import { toModelMessage } from "./message.js"

export interface ChatSummarizer {
    summarize(messages: ChatMessage[]): Promise<ChatMessage>
}

const summaryPrompt = await readFile(path.join(promptsDir, "chat-summary.md"), "utf8")

export class OpenAIChatSummarizer implements ChatSummarizer {
    private readonly model = new ChatOpenAI({
        apiKey: openAIApiKey,
        model: summaryModel,
        useResponsesApi: true,
    })

    public async summarize(messages: ChatMessage[]): Promise<ChatMessage> {
        const response = await this.model.invoke([
            { role: "system", content: summaryPrompt },
            ...messages.map(toModelMessage),
        ], {
            reasoning: { effort: "low" },
            verbosity: "low",
        })
        const content = getAnswer(response.content).trim()

        if (!content) {
            throw new Error("The summary model returned an empty response")
        }

        return {
            role: "assistant",
            content: Array.from(content).slice(0, 511).join(""),
        }
    }
}
