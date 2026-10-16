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

import { describe, expect, it } from "vitest"
import { GroupChatHistory, getGroupChatHistory } from "./group.js"

describe("GroupChatHistory", () => {
    it("keeps only the latest 100 messages, including the trigger", () => {
        const history = new GroupChatHistory()

        for (let id = 1; id <= 101; id++) {
            history.addMessage({ id, senderId: "1", senderName: "Ana", text: `Message ${id}`, timestamp: id })
        }

        expect(history.messages).toHaveLength(100)
        expect(history.messages[0].id).toBe(2)
        expect(history.messages.at(-1)?.id).toBe(101)
        expect(history.toXml(101)).toContain('<group_messages trigger_message_id="101">')
        expect(history.toXml(101)).toContain('Message 101</message>')
        expect(history.toXml(101)).not.toContain('Message 1</message>')
    })

    it("escapes sender details and message text in XML", () => {
        const history = new GroupChatHistory()
        history.addMessage({
            id: 5,
            senderId: "user&1",
            senderName: 'Ana <A> "B"',
            text: "Nymph: <hola> & 'adiós'",
            timestamp: 12
        })

        expect(history.toXml(5)).toContain('sender_id="user&amp;1" sender_name="Ana &lt;A&gt; &quot;B&quot;"')
        expect(history.toXml(5)).toContain('Nymph: &lt;hola&gt; &amp; &apos;adiós&apos;')
    })

    it("keeps separate histories for different groups", () => {
        expect(getGroupChatHistory("group-a")).toBe(getGroupChatHistory("group-a"))
        expect(getGroupChatHistory("group-a")).not.toBe(getGroupChatHistory("group-b"))
    })
})
