import { getAnimationFrames } from "./animation.js"
import { resizeImage } from "./image.js"
import { log } from "../logging.js"

export const maxRemoteMediaBytes = 20 * 1024 * 1024

const mediaTypes = new Map([
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".png", "image/png"],
    [".webp", "image/webp"],
    [".gif", "image/gif"],
    [".mp4", "video/mp4"]
])

const elapsedTime = (start: Date) =>  new Date().getTime() - start.getTime()

export async function downloadImages(url: string): Promise<string[]> {
    const mediaUrl = new URL(url)
    const startTime = new Date()

    if (mediaUrl.protocol !== "https:" && mediaUrl.protocol !== "http:") {
        throw new Error("Unsupported media URL protocol")
    }

    const response = await fetch(mediaUrl, { signal: AbortSignal.timeout(30_000) })

    if (!response.ok || !response.body) {
        log.debug({ time: elapsedTime(startTime), url }, 'downloadImages finished')
        throw new Error(`Media download failed with HTTP ${response.status}`)
    }

    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase()
    const extension = mediaUrl.pathname.slice(mediaUrl.pathname.lastIndexOf(".")).toLowerCase()
    const mimeType = !contentType || contentType === "application/octet-stream"
        ? mediaTypes.get(extension)
        : contentType

    if (!mimeType || ![...mediaTypes.values()].includes(mimeType)) {
        await response.body.cancel()
        log.debug({ time: elapsedTime(startTime), url }, 'downloadImages finished')
        throw new Error("Unsupported media format")
    }

    if (Number(response.headers.get("content-length")) > maxRemoteMediaBytes) {
        await response.body.cancel()
        log.debug({ time: elapsedTime(startTime), url }, 'downloadImages finished')
        throw new Error("Media exceeds the 20 MiB download limit")
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0

    try {
        while (true) {
            const { done, value } = await reader.read()

            if (done) {
                break
            }

            size += value.byteLength

            if (size > maxRemoteMediaBytes) {
                await reader.cancel()
                log.debug({ time: elapsedTime(startTime), url }, 'downloadImages finished')
                throw new Error("Media exceeds the 20 MiB download limit")
            }

            chunks.push(value)
        }
    } finally {
        reader.releaseLock()
    }

    const bytes = Buffer.concat(chunks, size)

    if (mimeType === "image/gif" || mimeType === "video/mp4") {
        const frames = getAnimationFrames(bytes, mimeType === "image/gif" ? "gif" : "mp4")
        log.debug({ time: elapsedTime(startTime), url }, 'downloadImages finished')
        return frames
    }

    const image = await resizeImage(bytes, mimeType)
    log.debug({ time: elapsedTime(startTime), url }, 'downloadImages finished')
    return [`data:${mimeType};base64,${image.toString("base64")}`]
}
