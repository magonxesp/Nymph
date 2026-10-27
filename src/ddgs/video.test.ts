import { describe, expect, it } from "vitest"
import { isVideoUrl } from "./video.js"

describe("video platform URLs", () => {
	it.each([
		"https://www.youtube.com/watch?v=123",
		"https://m.youtube.com/shorts/123",
		"https://youtu.be/123",
		"https://www.youtube-nocookie.com/embed/123",
		"https://player.vimeo.com/video/123",
		"https://www.dailymotion.com/video/123",
		"https://dai.ly/123",
		"https://www.twitch.tv/channel",
		"https://www.tiktok.com/@user/video/123",
		"https://WWW.YOUTUBE.COM./watch?v=123"
	])("excludes video platform URL %s", (url) => {
		expect(isVideoUrl(url)).toBe(true)
	})

	it.each([
		"https://example.com/article-about-youtube",
		"https://example.com/?source=youtube.com",
		"https://notyoutube.com/article",
		"https://youtube.com.example.org/article",
		"https://youtube.com@example.org/article"
	])("retains unrelated website %s", (url) => {
		expect(isVideoUrl(url)).toBe(false)
	})
})
