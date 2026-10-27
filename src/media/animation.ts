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
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

// Sample the first frame, then at most one per second, up to six frames.
export async function getAnimationFrames(bytes: Buffer, format: 'gif' | 'mp4'): Promise<string[]> {
	const directory = await mkdtemp(path.join(tmpdir(), 'nymph-animation-'))

	try {
		const input = path.join(directory, `input.${format}`)
		await writeFile(input, bytes)
		await run(
			'ffmpeg',
			[
				'-hide_banner',
				'-loglevel',
				'error',
				'-nostdin',
				'-protocol_whitelist',
				'file,pipe',
				'-f',
				format === 'gif' ? 'gif' : 'mov',
				'-i',
				input,
				'-an',
				'-vf',
				"select=eq(n\\,0)+gte(t-prev_selected_t\\,1),scale=w='min(768,iw)':h='min(768,ih)':force_original_aspect_ratio=decrease",
				'-fps_mode',
				'vfr',
				'-frames:v',
				'6',
				path.join(directory, 'frame-%02d.png')
			],
			{ timeout: 30_000, maxBuffer: 1024 * 1024 }
		)

		const frames = (await readdir(directory)).filter((name) => name.startsWith('frame-')).sort()

		if (frames.length === 0) {
			throw new Error('The animation contains no readable frames')
		}

		return await Promise.all(
			frames.map(async (name) => {
				const frame = await readFile(path.join(directory, name))
				return `data:image/png;base64,${frame.toString('base64')}`
			})
		)
	} catch {
		throw new Error('Failed to extract animation frames; check that ffmpeg is installed and the file is valid')
	} finally {
		await rm(directory, { recursive: true, force: true })
	}
}
