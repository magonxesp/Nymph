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
import { promisify } from "node:util"
import { beforeAll, describe, expect, it } from "vitest"
import { getAnimationFrames } from "./animation.js"

const run = promisify(execFile)
let gif: Buffer
let mp4: Buffer

beforeAll(async () => {
	const gifResult = await run(
		"ffmpeg",
		[
			"-hide_banner",
			"-loglevel",
			"error",
			"-f",
			"lavfi",
			"-i",
			"testsrc=size=16x16:rate=2:duration=7",
			"-f",
			"gif",
			"pipe:1"
		],
		{ encoding: "buffer" }
	)
	gif = gifResult.stdout

	const mp4Result = await run(
		"ffmpeg",
		[
			"-hide_banner",
			"-loglevel",
			"error",
			"-f",
			"lavfi",
			"-i",
			"testsrc=size=16x16:rate=2:duration=7",
			"-c:v",
			"libx264",
			"-pix_fmt",
			"yuv420p",
			"-movflags",
			"frag_keyframe+empty_moov",
			"-f",
			"mp4",
			"pipe:1"
		],
		{ encoding: "buffer" }
	)
	mp4 = mp4Result.stdout
})

describe("getAnimationFrames", () => {
	it("converts an animated GIF into at most six PNG images", async () => {
		const frames = await getAnimationFrames(gif, "gif")

		expect(frames).toHaveLength(6)
		expect(new Set(frames).size).toBeGreaterThan(1)

		for (const frame of frames) {
			expect(frame).toMatch(/^data:image\/png;base64,iVBOR/)
		}
	})

	it("converts Telegram MP4 animations into PNG images", async () => {
		const frames = await getAnimationFrames(mp4, "mp4")

		expect(frames).toHaveLength(6)
		expect(new Set(frames).size).toBeGreaterThan(1)
		expect(frames.every((frame) => frame.startsWith("data:image/png;base64,iVBOR"))).toBe(true)
	})

	it("keeps the first frame of a short, static GIF", async () => {
		const bytes = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")

		const frames = await getAnimationFrames(bytes, "gif")

		expect(frames).toHaveLength(1)
		expect(frames[0]).toMatch(/^data:image\/png;base64,iVBOR/)
	})

	it("reports invalid animation data", async () => {
		await expect(getAnimationFrames(Buffer.from("invalid"), "gif")).rejects.toThrow(
			"Failed to extract animation frames"
		)
	})
})
