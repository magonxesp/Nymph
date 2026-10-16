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
})
