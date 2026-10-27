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

import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'

export const maxImageDimension = 1024
const run = promisify(execFile)
const imageDimensionsSchema = z.object({
	streams: z
		.array(
			z.object({
				width: z.number().int().positive(),
				height: z.number().int().positive()
			})
		)
		.min(1)
})
const imageExtensions = new Map([
	['image/jpeg', 'jpg'],
	['image/png', 'png'],
	['image/webp', 'webp']
])

export async function resizeImage(bytes: Buffer, mimeType: string): Promise<Buffer> {
	const extension = imageExtensions.get(mimeType)

	if (!extension) {
		throw new Error('Unsupported image format for resizing')
	}

	const directory = await mkdtemp(path.join(tmpdir(), 'nymph-image-'))

	try {
		const input = path.join(directory, `input.${extension}`)
		await writeFile(input, bytes)
		const { stdout } = await run(
			'ffprobe',
			[
				'-v',
				'error',
				'-protocol_whitelist',
				'file,pipe',
				'-select_streams',
				'v:0',
				'-show_entries',
				'stream=width,height',
				'-of',
				'json',
				input
			],
			{ timeout: 30_000, maxBuffer: 1024 * 1024 }
		)
		const metadata: unknown = JSON.parse(stdout)
		const { width, height } = imageDimensionsSchema.parse(metadata).streams[0]

		if (width <= maxImageDimension && height <= maxImageDimension) {
			return bytes
		}

		const output = path.join(directory, `resized.${extension}`)
		await run(
			'ffmpeg',
			[
				'-hide_banner',
				'-loglevel',
				'error',
				'-nostdin',
				'-protocol_whitelist',
				'file,pipe',
				'-i',
				input,
				'-vf',
				`scale=w='min(${maxImageDimension},iw)':h='min(${maxImageDimension},ih)':force_original_aspect_ratio=decrease`,
				'-frames:v',
				'1',
				...(extension === 'jpg' ? ['-q:v', '3'] : []),
				output
			],
			{ timeout: 30_000, maxBuffer: 1024 * 1024 }
		)

		return await readFile(output)
	} catch {
		throw new Error('Failed to resize image; check that ffmpeg is installed and the file is valid')
	} finally {
		await rm(directory, { recursive: true, force: true })
	}
}
