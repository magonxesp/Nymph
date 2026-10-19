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

import { Api, Context } from "grammy"
import { afterEach, describe, expect, it, vi } from "vitest"
import { handleGroupMessage } from "./group.js"
import { getGroupChatHistory } from "../chat/group.js"
import { maxAttachmentBytes } from "./attachment.js"
import { handlePrivateMessage } from "./private.js"
import { getPrivateChatHistory } from "../chat/chat.js"

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }))

vi.mock("../agent/agent.js", () => ({
    createPrivateChatAgent: async () => ({ invoke: invokeMock }),
    createGroupChatAgent: async () => ({ invoke: invokeMock })
}))

const me = {
    id: 99,
    is_bot: true as const,
    first_name: "Nymph",
    username: "nymph_bot",
    can_join_groups: true,
    can_read_all_group_messages: true,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

describe("handlePrivateMessage images", () => {
    it("answers a photo without a caption and retains it in the history", async () => {

        const chat = { id: 8001, type: "private" as const, first_name: "Ana" }
        const api = new Api("test-token")
        vi.spyOn(api, "getFile").mockResolvedValue({ file_id: "photo", file_unique_id: "photo", file_path: "photos/photo.jpg" })
        const ctx = new Context({
            update_id: 1,
            message: {
                message_id: 1, date: 123, chat,
                from: { id: 1, is_bot: false, first_name: "Ana" },
                photo: [{ file_id: "photo", file_unique_id: "photo", width: 1280, height: 720 }]
            }
        }, api, me)
        const reply = vi.spyOn(ctx, "reply").mockResolvedValue({ message_id: 2, date: 124, chat, text: "Veo una imagen" })
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]))))
        invokeMock.mockResolvedValue({ messages: [{ content: "Veo una imagen" }] })

        if (!ctx.has("message")) {
            throw new Error("Expected a message context")
        }

        await handlePrivateMessage(ctx)

        expect(invokeMock.mock.calls[0][0].messages[0].content).toEqual([
            { type: "text", text: "[imagen sin texto]" },
            { type: "image_url", image_url: { url: "data:image/jpeg;base64,AQID" } }
        ])
        expect(reply).toHaveBeenCalledWith("Veo una imagen")
        expect(getPrivateChatHistory("telegram:8001").messages[0].images).toEqual(["data:image/jpeg;base64,AQID"])
    })
})

it.each(["private", "group"] as const)("silently discards oversized attachments in %s chats", async (chatType) => {
    const chat = chatType === "private"
        ? { id: 8002, type: "private" as const, first_name: "Ana" }
        : { id: -8002, type: "group" as const, title: "Test group" }
    const api = new Api("test-token")
    const getFile = vi.spyOn(api, "getFile")
    const ctx = new Context({
        update_id: 2,
        message: {
            message_id: 2, date: 123, chat,
            from: { id: 1, is_bot: false, first_name: "Ana" },
            caption: "@nymph_bot revisa este archivo",
            caption_entities: [{ type: "mention", offset: 0, length: 10 }],
            document: { file_id: "huge", file_unique_id: "huge", file_size: maxAttachmentBytes + 1 }
        }
    }, api, me)
    const reply = vi.spyOn(ctx, "reply")

    if (!ctx.has("message")) {
        throw new Error("Expected a message context")
    }

    if (chatType === "private") {
        await handlePrivateMessage(ctx)
        expect(getPrivateChatHistory(`telegram:${chat.id}`).messages).toEqual([])
    } else {
        await handleGroupMessage(ctx)
        expect(getGroupChatHistory(`telegram:${chat.id}`).messages).toEqual([])
    }

    expect(getFile).not.toHaveBeenCalled()
    expect(invokeMock).not.toHaveBeenCalled()
    expect(reply).not.toHaveBeenCalled()
})

it("passes a document without a caption to the private chat model", async () => {
    const chat = { id: 8003, type: "private" as const, first_name: "Ana" }
    const api = new Api("test-token")
    vi.spyOn(api, "getFile").mockResolvedValue({ file_id: "doc", file_unique_id: "doc", file_path: "documents/report.pdf" })
    const ctx = new Context({
        update_id: 3,
        message: {
            message_id: 3, date: 123, chat,
            from: { id: 1, is_bot: false, first_name: "Ana" },
            document: { file_id: "doc", file_unique_id: "doc", file_name: "report.pdf", mime_type: "application/pdf" }
        }
    }, api, me)
    vi.spyOn(ctx, "reply").mockResolvedValue({ message_id: 4, date: 124, chat, text: "He leído el documento" })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]))))
    invokeMock.mockResolvedValue({ messages: [{ content: "He leído el documento" }] })

    if (!ctx.has("message")) {
        throw new Error("Expected a message context")
    }

    await handlePrivateMessage(ctx)

    expect(invokeMock.mock.calls[0][0].messages[0].content).toEqual([
        { type: "text", text: "[archivo sin texto]" },
        { type: "input_file", filename: "report.pdf", file_data: "data:application/pdf;base64,AQID" }
    ])
    expect(getPrivateChatHistory("telegram:8003").messages[0].files).toEqual([
        { filename: "report.pdf", mimeType: "application/pdf", data: "AQID" }
    ])
})
