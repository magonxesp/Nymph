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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { z } from "zod"
import { XmlBooruClient } from "./xmlbooru.js"
import type { GetPostsOptions, Posts } from "./post.js"
import type { Tag } from "./tag.js"

export type MoebooruClientOptions = {
	baseUrl?: string
}

export class MoebooruClient extends XmlBooruClient {
	public constructor(options: MoebooruClientOptions = {}) {
		super(options.baseUrl ?? "https://yande.re/")
	}

	public override async getPosts(tags: string | string[], options: GetPostsOptions = {}): Promise<Posts> {
		const { limit = 100, page = 0, id, changeId } = options
		const searchTags = Array.isArray(tags) ? [...tags] : [tags]

		if (id !== undefined) {
			searchTags.push(`id:${id}`)
		}

		if (changeId !== undefined) {
			throw new Error("Moebooru does not support changeId searches")
		}

		const url = new URL("post.xml", this.baseUrl)
		url.searchParams.set("tags", searchTags.join(" ").trim())
		url.searchParams.set("limit", String(limit))
		url.searchParams.set("page", String(page + 1))
		const response = await fetch(url)

		if (!response.ok) {
			throw new Error(`Booru request failed with HTTP ${response.status}`)
		}

		return this.parsePosts(await response.text())
	}

	public override async autocompleteTags(query: string): Promise<Tag[]> {
		const url = new URL("tag.json", this.baseUrl)
		url.searchParams.set("name", `${query}*`)
		url.searchParams.set("order", "count")
		url.searchParams.set("limit", "20")
		const response = await fetch(url)

		if (!response.ok) {
			throw new Error(`Booru request failed with HTTP ${response.status}`)
		}

		const data: unknown = await response.json()
		const tags = z.array(z.object({ name: z.string() })).parse(data)

		return tags.map((tag) => ({ label: tag.name, value: tag.name }))
	}
}

export class KonachanClient extends MoebooruClient {
	public constructor(options: MoebooruClientOptions = {}) {
		super({ baseUrl: "https://konachan.com/", ...options })
	}
}

export class KonachanNetClient extends MoebooruClient {
	public constructor(options: MoebooruClientOptions = {}) {
		super({ baseUrl: "https://konachan.net/", ...options })
	}
}

export class YandereClient extends MoebooruClient {
	public constructor(options: MoebooruClientOptions = {}) {
		super({ baseUrl: "https://yande.re/", ...options })
	}
}
