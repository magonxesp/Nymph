import "dotenv/config"
import { describe, expect, it } from "vitest"
import { GelBooruClient, SafeBooruClient, Rule34Client } from "./gelbooru.js"
import { gelbooruApiKey, gelbooruUserId, rule34ApiKey, rule34UserId } from "../env.js"

describe.each([
	{
		name: "Gelbooru",
		client: new GelBooruClient(),
		missingCredentials: !gelbooruApiKey || !gelbooruUserId
	},
	{
		name: "Safebooru",
		client: new SafeBooruClient(),
		missingCredentials: false
	}
])("$name DAPI integration", ({ client, missingCredentials }) => {
	it("retrieves real tag suggestions", async () => {
		const tags = await client.autocompleteTags("sk")

		expect(tags.length).toBeGreaterThan(0)
		expect(tags.every((tag) => typeof tag.label === "string" && typeof tag.value === "string")).toBe(true)
		expect(tags.some((tag) => tag.value.startsWith("sk"))).toBe(true)
	}, 30_000)

	it.skipIf(missingCredentials)(
		"retrieves a real page and finds a returned post by ID",
		async () => {
			const posts = await client.getPosts("landscape", {
				limit: 1,
				page: 1
			})

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
		},
		30_000
	)

	it.skipIf(missingCredentials)(
		"retrieves a random post matching real search results",
		async () => {
			const posts = await client.getPosts("landscape", { limit: 1 })

			expect(posts.items).toHaveLength(1)
			const referencePost = posts.items[0]
			const post = await client.getRandomPost(["landscape", `id:${referencePost.id}`])

			expect(post).toBeDefined()
			expect(post?.id).toBe(referencePost.id)
			expect(post?.tags.split(" ")).toContain("landscape")
		},
		30_000
	)
})

const referencePostId = 19068437
const client = new Rule34Client()

describe("Rule34 API integration", () => {
	it("retrieves real tag suggestions", async () => {
		const tags = await client.autocompleteTags("ny")

		expect(tags.length).toBeGreaterThan(0)
		expect(tags).toEqual(expect.arrayContaining([expect.objectContaining({ value: "nymph" })]))
		expect(tags.every((tag) => typeof tag.label === "string" && typeof tag.value === "string")).toBe(true)
	}, 30_000)

	describe.skipIf(!rule34ApiKey || !rule34UserId)("authenticated posts", () => {
		it("retrieves the reference post through the XML API", async () => {
			const posts = await client.getPosts("", {
				id: referencePostId,
				limit: 1
			})

			expect(posts.count).toBeGreaterThan(0)
			expect(posts.offset).toBeGreaterThanOrEqual(0)
			expect(posts.items).toHaveLength(1)
			expect(posts.items[0].id).toBe(referencePostId)
			expect(typeof posts.items[0].file_url).toBe("string")
			expect(typeof posts.items[0].score).toBe("number")
			expect(typeof posts.items[0].has_children).toBe("boolean")
		}, 30_000)

		it("retrieves a random post from real search results", async () => {
			const post = await client.getRandomPost("nymph")

			expect(post).toBeDefined()
			expect(post?.id).toEqual(expect.any(Number))
			expect(post?.file_url).toMatch(/^https?:\/\//)
		}, 30_000)
	})
})
