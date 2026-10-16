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

import { describe, expect, it, vi } from "vitest"
import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage } from "@langchain/core/messages"
import { OpenAIChatSummarizer } from "./summarizer.js"

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}))

vi.mock("@langchain/openai", () => ({
    ChatOpenAI: vi.fn(function () {
        return { invoke: invokeMock }
    }),
}))

describe("OpenAIChatSummarizer", () => {
    it("summarizes the conversation with a short prompt and low reasoning", async () => {
        invokeMock.mockResolvedValueOnce({ content: "  El usuario prefiere respuestas breves.  " })

        const summary = await new OpenAIChatSummarizer().summarize([
            { role: "user", content: "Prefiero respuestas breves" },
        ])

        expect(ChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({
            model: "gpt-6-luna",
            useResponsesApi: true,
        }))
        expect(invokeMock).toHaveBeenCalledWith([
            { role: "system", content: expect.stringContaining("menos de 512 caracteres") },
            new HumanMessage("Prefiero respuestas breves"),
        ], {
            reasoning: { effort: "low" },
            verbosity: "low",
        })
        expect(summary).toEqual({ role: "assistant", content: "El usuario prefiere respuestas breves." })
    })

    it("limits the summary to fewer than 512 characters", async () => {
        invokeMock.mockResolvedValueOnce({ content: "a".repeat(600) })

        const summary = await new OpenAIChatSummarizer().summarize([])

        expect(Array.from(summary.content)).toHaveLength(511)
    })
})
