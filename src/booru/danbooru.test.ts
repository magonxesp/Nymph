import "dotenv/config"
import { describe, expect, it } from "vitest"
import { DanBooruClient } from "./danbooru.js"

describe("Danbooru 2 API integration", () => {
	const client = new DanBooruClient()

	it("retrieves real tag suggestions", async () => {
		const tags = await client.autocompleteTags("sk")

		expect(tags.length).toBeGreaterThan(0)
		expect(tags.every((tag) => typeof tag.label === "string" && typeof tag.value === "string")).toBe(true)
		expect(tags.some((tag) => tag.value.startsWith("sk"))).toBe(true)
	}, 30_000)

	it("retrieves a real page and finds a returned post by ID", async () => {
		const posts = await client.getPosts("landscape", { limit: 1, page: 1 })

		expect(posts.count).toBeGreaterThan(1)
		expect(posts.offset).toBe(1)
		expect(posts.items).toHaveLength(1)
		const post = posts.items[0]
		expect(post.id).toEqual(expect.any(Number))
		expect(post.tags.split(" ")).toContain("landscape")
		expect(post.score).toEqual(expect.any(Number))
		expect(typeof post.file_url).toBe("string")

		const matchingPosts = await client.getPosts("", {
			id: post.id,
			limit: 1
		})

		expect(matchingPosts.items).toHaveLength(1)
		expect(matchingPosts.items[0].id).toBe(post.id)
	}, 30_000)

	it("retrieves a random post matching real search results", async () => {
		const posts = await client.getPosts("landscape", { limit: 1 })

		expect(posts.items).toHaveLength(1)
		const referencePost = posts.items[0]
		const post = await client.getRandomPost(["landscape", `id:${referencePost.id}`])

		expect(post).toBeDefined()
		expect(post?.id).toBe(referencePost.id)
		expect(post?.tags.split(" ")).toContain("landscape")
	}, 30_000)
})
