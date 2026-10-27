const videoDomains = [
	"youtube.com",
	"youtu.be",
	"youtube-nocookie.com",
	"vimeo.com",
	"dailymotion.com",
	"dai.ly",
	"twitch.tv",
	"tiktok.com"
]

export function isVideoUrl(url: string): boolean {
	const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, "")
	return videoDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
}
