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

import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { describe, expect, it } from "vitest"
import { resizeImage } from "./image.js"

const run = promisify(execFile)

describe("resizeImage", () => {
	it.each([
		{
			mimeType: "image/jpeg",
			extension: "jpg",
			codec: "mjpeg",
			width: 2048,
			height: 1024,
			expectedWidth: 1024,
			expectedHeight: 512
		},
		{
			mimeType: "image/png",
			extension: "png",
			codec: "png",
			width: 1024,
			height: 2048,
			expectedWidth: 512,
			expectedHeight: 1024
		},
		{
			mimeType: "image/webp",
			extension: "webp",
			codec: "webp",
			width: 2048,
			height: 2048,
			expectedWidth: 1024,
			expectedHeight: 1024
		},
		{
			mimeType: "image/png",
			extension: "png",
			codec: "png",
			width: 2000,
			height: 100,
			expectedWidth: 1024,
			expectedHeight: 51
		},
		{
			mimeType: "image/png",
			extension: "png",
			codec: "png",
			width: 128,
			height: 64,
			expectedWidth: 128,
			expectedHeight: 64
		},
		{
			mimeType: "image/jpeg",
			extension: "jpg",
			codec: "mjpeg",
			width: 1024,
			height: 512,
			expectedWidth: 1024,
			expectedHeight: 512
		}
	])(
		"limits $mimeType $width × $height to $expectedWidth × $expectedHeight",
		async ({ mimeType, extension, codec, width, height, expectedWidth, expectedHeight }) => {
			const directory = await mkdtemp(path.join(tmpdir(), "nymph-image-test-"))

			try {
				const input = path.join(directory, `input.${extension}`)
				await run("ffmpeg", [
					"-hide_banner",
					"-loglevel",
					"error",
					"-f",
					"lavfi",
					"-i",
					`testsrc=size=${width}x${height}:rate=1`,
					"-frames:v",
					"1",
					input
				])
				const original = await readFile(input)

				const resized = await resizeImage(original, mimeType)

				const output = path.join(directory, `output.${extension}`)
				await writeFile(output, resized)
				const { stdout } = await run("ffprobe", [
					"-v",
					"error",
					"-select_streams",
					"v:0",
					"-show_entries",
					"stream=width,height,codec_name",
					"-of",
					"json",
					output
				])
				const metadata: unknown = JSON.parse(stdout)

				expect(metadata).toEqual(
					expect.objectContaining({
						streams: [
							{
								width: expectedWidth,
								height: expectedHeight,
								codec_name: codec
							}
						]
					})
				)

				if (width <= 1024 && height <= 1024) {
					expect(resized).toEqual(original)
				}
			} finally {
				await rm(directory, { recursive: true, force: true })
			}
		}
	)

	it("reports malformed image data", async () => {
		await expect(resizeImage(Buffer.from("invalid image"), "image/png")).rejects.toThrow("Failed to resize image")
	})
})
