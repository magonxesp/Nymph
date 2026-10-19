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

import type { Api } from "grammy"
import type { Message } from "grammy/types"
import { getAnimationFrames } from "../media/animation.js"
import type { ChatAttachments } from "../chat/attachment.js"

export const maxAttachmentBytes = 10 * 1024 * 1024
const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

function getAttachment(message: Message) {
    const photo = message.photo?.length
        ? message.photo.reduce((largest, current) =>
            current.width * current.height > largest.width * largest.height ? current : largest
        )
        : undefined

    if (photo) {
        return { ...photo, mime_type: "image/jpeg", file_name: "photo.jpg" }
    }

    if (message.animation) {
        return message.animation
    }

    if (message.document) {
        return message.document
    }

    if (message.audio) {
        return message.audio
    }

    if (message.video) {
        return message.video
    }

    if (message.voice) {
        return { ...message.voice, file_name: "voice.ogg" }
    }

    if (message.video_note) {
        return { ...message.video_note, mime_type: "video/mp4", file_name: "video.mp4" }
    }

    if (message.sticker) {
        const sticker = message.sticker
        const mimeType = sticker.is_video ? "video/webm" : sticker.is_animated ? "application/x-tgsticker" : "image/webp"
        return { ...sticker, mime_type: mimeType }
    }

    return undefined
}

// null means the entire message must be silently discarded for exceeding the size limit.
export async function getTelegramAttachments(message: Message, api: Pick<Api, "getFile" | "token">): Promise<ChatAttachments | null> {
    const attachment = getAttachment(message)

    if (!attachment) {
        return { images: [], files: [] }
    }

    if (attachment.file_size !== undefined && attachment.file_size > maxAttachmentBytes) {
        return null
    }

    const file = await api.getFile(attachment.file_id)

    if (file.file_size !== undefined && file.file_size > maxAttachmentBytes) {
        return null
    }

    if (!file.file_path) {
        throw new Error("Telegram did not return an attachment download path")
    }

    let bytes: Buffer

    try {
        // Download locally so the Telegram bot token is never sent to the model.
        const response = await fetch(`https://api.telegram.org/file/bot${api.token}/${file.file_path}`, {
            signal: AbortSignal.timeout(30_000)
        })

        if (!response.ok || !response.body) {
            throw new Error("Attachment download failed")
        }

        const contentLength = Number(response.headers.get("content-length"))

        if (contentLength > maxAttachmentBytes) {
            await response.body.cancel()
            return null
        }

        const reader = response.body.getReader()
        const chunks: Uint8Array[] = []
        let size = 0

        while (true) {
            const { done, value } = await reader.read()

            if (done) {
                break
            }

            size += value.byteLength

            if (size > maxAttachmentBytes) {
                await reader.cancel()
                return null
            }

            chunks.push(value)
        }

        bytes = Buffer.concat(chunks, size)
    } catch {
        // Fetch errors may contain the URL, which includes the bot token.
        throw new Error("Failed to download the Telegram attachment")
    }

    const filename = attachment.file_name ?? file.file_path.split("/").at(-1) ?? "attachment"
    const signature = bytes.subarray(0, 6).toString("ascii")
    const isGif = signature === "GIF87a" || signature === "GIF89a"
    const isMp4 = bytes.subarray(4, 8).toString("ascii") === "ftyp" || attachment.mime_type === "video/mp4"
    const hasGifMetadata = attachment.mime_type === "image/gif" || filename.toLowerCase().endsWith(".gif")

    if (isGif || hasGifMetadata || message.animation) {
        const format = isGif || (hasGifMetadata && !isMp4) ? "gif" : "mp4"
        return { images: await getAnimationFrames(bytes, format), files: [] }
    }

    const mimeType = attachment.mime_type ?? "application/octet-stream"
    const data = bytes.toString("base64")

    if (imageMimeTypes.has(mimeType)) {
        return { images: [`data:${mimeType};base64,${data}`], files: [] }
    }

    return {
        images: [],
        files: [{
            filename,
            mimeType,
            data
        }]
    }
}
