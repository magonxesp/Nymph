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

import { AIMessage, HumanMessage } from "@langchain/core/messages"
import { describe, expect, it } from "vitest"
import { toModelMessage } from "./message.js"

describe("toModelMessage", () => {
    it("maps a stored user message to a HumanMessage", () => {
        const message = toModelMessage({ role: "user", content: "Hola" })

        expect(message).toBeInstanceOf(HumanMessage)
        expect(message.content).toBe("Hola")
    })

    it("maps a stored assistant message to an AIMessage", () => {
        const message = toModelMessage({ role: "assistant", content: "Hola" })

        expect(message).toBeInstanceOf(AIMessage)
        expect(message.content).toBe("Hola")
    })

    it("includes downloaded assistant images with explicit attribution", () => {
        const image = "data:image/png;base64,AQID"
        const message = toModelMessage({ role: "assistant", content: "https://example.com/image.png", images: [image] })

        expect(message).toBeInstanceOf(HumanMessage)
        expect(message.content).toEqual([
            { type: "text", text: "Contenido multimedia enviado por el asistente: https://example.com/image.png" },
            { type: "image_url", image_url: { url: image } }
        ])
    })
})

it("sends the caption and image together as multimodal content", () => {
    const image = "data:image/png;base64,AQID"
    const message = toModelMessage({ role: "user", content: "¿Qué ves?", images: [image] })

    expect(message).toBeInstanceOf(HumanMessage)
    expect(message.content).toEqual([
        { type: "text", text: "¿Qué ves?" },
        { type: "image_url", image_url: { url: image } }
    ])
})

it("sends arbitrary files with their names and MIME types", () => {
    const message = toModelMessage({
        role: "user",
        content: "Revisa el adjunto",
        files: [{ filename: "report.pdf", mimeType: "application/pdf", data: "AQID" }]
    })

    expect(message.content).toEqual([
        { type: "text", text: "Revisa el adjunto" },
        { type: "input_file", filename: "report.pdf", file_data: "data:application/pdf;base64,AQID" }
    ])
})
