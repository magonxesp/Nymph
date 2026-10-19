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

import { afterEach, describe, expect, it, vi } from "vitest"
import type { Message } from "grammy/types"
import { getAnimationFrames } from "../media/animation.js"
import { getTelegramAttachments, maxAttachmentBytes } from "./attachment.js"

vi.mock("../media/animation.js", () => ({
    getAnimationFrames: vi.fn().mockResolvedValue(["data:image/png;base64,frame"])
}))

const baseMessage = {
    message_id: 1,
    date: 123,
    chat: { id: 1, type: "private" as const, first_name: "Ana" }
}
const photoMessage: Message = {
    ...baseMessage,
    caption: "¿Qué ves?",
    photo: [
        { file_id: "large", file_unique_id: "large", width: 1280, height: 720 },
        { file_id: "small", file_unique_id: "small", width: 320, height: 180 }
    ]
}

function createApi() {
    return {
        token: "test-token",
        getFile: vi.fn().mockResolvedValue({ file_id: "large", file_unique_id: "large", file_path: "photos/image.jpg" })
    }
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

describe("getTelegramAttachments", () => {
    it("downloads the largest photo and returns inline image data without the bot token", async () => {
        const api = createApi()
        const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])))
        vi.stubGlobal("fetch", fetchMock)

        const images = await getTelegramAttachments(photoMessage, api)

        expect(api.getFile).toHaveBeenCalledWith("large")
        expect(fetchMock).toHaveBeenCalledWith(
            "https://api.telegram.org/file/bottest-token/photos/image.jpg",
            { signal: expect.any(AbortSignal) }
        )
        expect(images).toEqual({ images: ["data:image/jpeg;base64,AQID"], files: [] })
        expect(JSON.stringify(images)).not.toContain(api.token)
    })

    it("supports images sent as documents", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]))))

        const images = await getTelegramAttachments({
            ...baseMessage,
            document: { file_id: "png", file_unique_id: "png", mime_type: "image/png" }
        }, createApi())

        expect(images).toEqual({ images: ["data:image/png;base64,AQID"], files: [] })
    })

    it.each([
        { mime_type: "image/gif", file_name: "animation.gif" },
        { file_name: "animation.GIF" }
    ])("converts GIF documents to visual frames even with missing MIME metadata: %j", async metadata => {
        const bytes = Buffer.from("GIF89a")
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes)))

        const attachments = await getTelegramAttachments({
            ...baseMessage,
            document: { file_id: "gif", file_unique_id: "gif", ...metadata }
        }, createApi())

        expect(getAnimationFrames).toHaveBeenCalledWith(bytes, "gif")
        expect(attachments).toEqual({ images: ["data:image/png;base64,frame"], files: [] })
    })

    it("prioritizes Telegram animations over their legacy document field", async () => {
        const bytes = new Uint8Array([1, 2, 3])
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes)))
        const api = createApi()

        const attachments = await getTelegramAttachments({
            ...baseMessage,
            animation: { file_id: "animation", file_unique_id: "animation", width: 16, height: 16, duration: 2, mime_type: "video/mp4", file_name: "animation.gif" },
            document: { file_id: "document", file_unique_id: "document", mime_type: "application/octet-stream" }
        }, api)

        expect(api.getFile).toHaveBeenCalledWith("animation")
        expect(getAnimationFrames).toHaveBeenCalledWith(Buffer.from(bytes), "mp4")
        expect(attachments).toEqual({ images: ["data:image/png;base64,frame"], files: [] })
    })

    it("silently discards oversized GIFs before extracting any frames", async () => {
        const api = createApi()

        expect(await getTelegramAttachments({
            ...baseMessage,
            animation: { file_id: "gif", file_unique_id: "gif", width: 16, height: 16, duration: 2, mime_type: "image/gif", file_size: maxAttachmentBytes + 1 }
        }, api)).toBeNull()
        expect(api.getFile).not.toHaveBeenCalled()
        expect(getAnimationFrames).not.toHaveBeenCalled()
    })

    it("ignores text messages without downloading", async () => {
        const api = createApi()

        expect(await getTelegramAttachments({ ...baseMessage, text: "Hola" }, api)).toEqual({ images: [], files: [] })
        expect(api.getFile).not.toHaveBeenCalled()
    })

    it.each([
        ["application/pdf", "report.pdf"],
        ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "report.docx"],
        ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "table.xlsx"],
        ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "slides.pptx"],
        ["text/plain", "notes.txt"],
        ["text/csv", "table.csv"],
        ["application/json", "data.json"],
        ["application/yaml", "config.yaml"]
    ])("accepts supported documents with MIME type %s", async (mimeType, filename) => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]))))

        expect(await getTelegramAttachments({
            ...baseMessage,
            document: { file_id: "file", file_unique_id: "file", mime_type: mimeType, file_name: filename }
        }, createApi())).toEqual({
            images: [],
            files: [{ filename, mimeType: mimeType ?? "application/octet-stream", data: "AQID" }]
        })
    })

    it.each([
        "application/zip", "application/octet-stream", "image/svg+xml", "image/bmp",
        "audio/mpeg", "audio/ogg", "video/mp4", "video/webm", "application/x-tgsticker",
        "text/unsupported", undefined
    ])("silently discards unsupported or unknown MIME type %s without downloading", async mimeType => {
        const api = createApi()
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)

        expect(await getTelegramAttachments({
            ...baseMessage,
            caption: "Revisa esto",
            document: { file_id: "file", file_unique_id: "file", mime_type: mimeType }
        }, api)).toBeNull()
        expect(api.getFile).not.toHaveBeenCalled()
        expect(fetchMock).not.toHaveBeenCalled()
        expect(getAnimationFrames).not.toHaveBeenCalled()
    })

    it("normalizes MIME casing and parameters", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]))))

        const attachments = await getTelegramAttachments({
            ...baseMessage,
            document: { file_id: "file", file_unique_id: "file", mime_type: " Text/Plain; charset=UTF-8 ", file_name: "notes.txt" }
        }, createApi())

        expect(attachments?.files[0].mimeType).toBe("text/plain")
    })

    it("rejects unsupported animation formats instead of forwarding them to the model", async () => {
        const api = createApi()

        expect(await getTelegramAttachments({
            ...baseMessage,
            animation: { file_id: "animation", file_unique_id: "animation", width: 16, height: 16, duration: 2, mime_type: "video/webm" }
        }, api)).toBeNull()
        expect(api.getFile).not.toHaveBeenCalled()
    })

    it("silently discards oversized attachments before looking up the file", async () => {
        const api = createApi()

        expect(await getTelegramAttachments({
            ...baseMessage,
            document: { file_id: "huge", file_unique_id: "huge", file_size: maxAttachmentBytes + 1 }
        }, api)).toBeNull()
        expect(api.getFile).not.toHaveBeenCalled()
    })

    it("checks the file size returned by Telegram before downloading", async () => {
        const api = createApi()
        api.getFile.mockResolvedValueOnce({ file_path: "file.bin", file_size: maxAttachmentBytes + 1 })
        const fetchMock = vi.fn()
        vi.stubGlobal("fetch", fetchMock)

        expect(await getTelegramAttachments(photoMessage, api)).toBeNull()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("accepts exactly 10 MB", async () => {
        const data = new Uint8Array(maxAttachmentBytes)
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(data)))

        const attachments = await getTelegramAttachments({
            ...baseMessage,
            document: { file_id: "file", file_unique_id: "file", file_size: maxAttachmentBytes, mime_type: "application/pdf" }
        }, createApi())

        expect(attachments?.files[0].data).toBe(Buffer.from(data).toString("base64"))
    })

    it("silently discards a download whose declared length exceeds 10 MB", async () => {
        const cancel = vi.fn()
        const body = new ReadableStream({ cancel })
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, {
            headers: { "content-length": String(maxAttachmentBytes + 1) }
        })))

        expect(await getTelegramAttachments(photoMessage, createApi())).toBeNull()
        expect(cancel).toHaveBeenCalled()
    })

    it("stops streaming once actual bytes exceed 10 MB even if metadata is incorrect", async () => {
        const cancel = vi.fn()
        const body = new ReadableStream({
            start(controller) {
                controller.enqueue(new Uint8Array(maxAttachmentBytes))
                controller.enqueue(new Uint8Array(1))
            },
            cancel
        })
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, {
            headers: { "content-length": "1" }
        })))

        expect(await getTelegramAttachments(photoMessage, createApi())).toBeNull()
        expect(cancel).toHaveBeenCalled()
    })

    it("rejects missing file paths", async () => {
        const api = createApi()
        api.getFile.mockResolvedValueOnce({ file_id: "large", file_unique_id: "large" })

        await expect(getTelegramAttachments(photoMessage, api)).rejects.toThrow("download path")
    })

    it("handles HTTP failures and removes download URLs from errors", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(null, { status: 404 }))
            .mockRejectedValueOnce(new Error("https://api.telegram.org/file/bottest-token/photos/image.jpg"))
        vi.stubGlobal("fetch", fetchMock)

        await expect(getTelegramAttachments(photoMessage, createApi())).rejects.toThrow("Failed to download the Telegram attachment")
        await expect(getTelegramAttachments(photoMessage, createApi())).rejects.toThrow("Failed to download the Telegram attachment")
    })

    it("accepts empty files", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array())))

        const attachments = await getTelegramAttachments({
            ...baseMessage,
            document: { file_id: "file", file_unique_id: "file", file_name: "empty.txt", mime_type: "text/plain" }
        }, createApi())

        expect(attachments?.files).toEqual([{ filename: "empty.txt", mimeType: "text/plain", data: "" }])
    })
})
