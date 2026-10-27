import { afterEach, describe, expect, it, vi } from 'vitest'
import { resizeImage } from './image.js'
import { getAnimationFrames } from './animation.js'
import { downloadImages, maxRemoteMediaBytes } from './remote.js'

vi.mock('./image.js', () => ({ resizeImage: vi.fn() }))
vi.mock('./animation.js', () => ({ getAnimationFrames: vi.fn() }))

afterEach(() => {
	vi.resetAllMocks()
	vi.unstubAllGlobals()
})

describe('downloadImages', () => {
	it.each(['image/jpeg', 'image/png', 'image/webp'])('encodes resized %s bytes for vision', async (mimeType) => {
		const fetchMedia = vi.fn().mockResolvedValue(
			new Response(new Uint8Array([1, 2, 3]), {
				headers: { 'content-type': `${mimeType}; charset=binary` }
			})
		)
		vi.stubGlobal('fetch', fetchMedia)
		vi.mocked(resizeImage).mockResolvedValue(Buffer.from([4, 5, 6]))

		await expect(downloadImages('https://example.com/image')).resolves.toEqual([`data:${mimeType};base64,BAUG`])
		expect(resizeImage).toHaveBeenCalledWith(Buffer.from([1, 2, 3]), mimeType)
		expect(fetchMedia).toHaveBeenCalledWith(new URL('https://example.com/image'), {
			signal: expect.any(AbortSignal)
		})
	})

	it('uses the extension when the server returns generic binary data', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(new Uint8Array([1]), {
					headers: { 'content-type': 'application/octet-stream' }
				})
			)
		)
		vi.mocked(resizeImage).mockResolvedValue(Buffer.from([1]))

		await expect(downloadImages('https://example.com/IMAGE.PNG?download=1')).resolves.toEqual([
			'data:image/png;base64,AQ=='
		])
	})

	it.each([
		{ mimeType: 'image/gif', format: 'gif' },
		{ mimeType: 'video/mp4', format: 'mp4' }
	])('extracts visual frames from $mimeType', async ({ mimeType, format }) => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(new Uint8Array([1]), {
					headers: { 'content-type': mimeType }
				})
			)
		)
		const frames = ['data:image/png;base64,AQ==', 'data:image/png;base64,Ag==']
		vi.mocked(getAnimationFrames).mockResolvedValue(frames)

		await expect(downloadImages('https://example.com/animation')).resolves.toEqual(frames)
		expect(getAnimationFrames).toHaveBeenCalledWith(Buffer.from([1]), format)
		expect(resizeImage).not.toHaveBeenCalled()
	})

	it('reports HTTP errors', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })))

		await expect(downloadImages('https://example.com/image.png')).rejects.toThrow('HTTP 503')
	})

	it('rejects non-image responses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response('not an image', {
					headers: { 'content-type': 'text/html' }
				})
			)
		)

		await expect(downloadImages('https://example.com/image.png')).rejects.toThrow('Unsupported media format')
		expect(resizeImage).not.toHaveBeenCalled()
	})

	it('rejects oversized responses from the declared size', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(new Uint8Array([1]), {
					headers: {
						'content-type': 'image/png',
						'content-length': String(maxRemoteMediaBytes + 1)
					}
				})
			)
		)

		await expect(downloadImages('https://example.com/image.png')).rejects.toThrow('download limit')
	})

	it('cancels oversized streams even without a declared size', async () => {
		const cancel = vi.fn()
		const body = new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array(maxRemoteMediaBytes + 1))
			},
			cancel
		})
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(body, {
					headers: { 'content-type': 'image/png' }
				})
			)
		)

		await expect(downloadImages('https://example.com/image.png')).rejects.toThrow('download limit')
		expect(cancel).toHaveBeenCalled()
	})

	it('rejects local file URLs before downloading', async () => {
		const fetchMedia = vi.fn()
		vi.stubGlobal('fetch', fetchMedia)

		await expect(downloadImages('file:///tmp/image.png')).rejects.toThrow('protocol')
		expect(fetchMedia).not.toHaveBeenCalled()
	})
})
