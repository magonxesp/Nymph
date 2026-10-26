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

import { z } from 'zod'
import type { BooruClient } from './client.js'
import type { GetPostsOptions, Post, Posts } from './post.js'
import type { Tag } from './tag.js'

export type DanBooruClientOptions = {
    baseUrl?: string
    apiKey?: string
    login?: string
    userAgent?: string
}

type DanBooruPost = {
    id: number
    file_url?: string | null
    tag_string: string
    rating: string
    score: number
    image_width?: number
    image_height?: number
    parent_id?: number | null
    large_file_url?: string | null
    preview_file_url?: string | null
    source?: string
    md5?: string | null
}

const postSchema: z.ZodType<DanBooruPost> = z.object({
    id: z.number().int(),
    file_url: z.string().nullish(),
    tag_string: z.string(),
    rating: z.string(),
    score: z.number(),
    image_width: z.number().optional(),
    image_height: z.number().optional(),
    parent_id: z.number().nullish(),
    large_file_url: z.string().nullish(),
    preview_file_url: z.string().nullish(),
    source: z.string().optional(),
    md5: z.string().nullish()
})

export class DanBooruClient implements BooruClient {
    private readonly baseUrl: URL
    private readonly options: DanBooruClientOptions

    public constructor(options: DanBooruClientOptions = {}) {
        const hasOneCredential = (options.apiKey === undefined) !== (options.login === undefined)

        if (hasOneCredential) {
            throw new Error('Danbooru apiKey and login must be provided together')
        }

        const baseUrl = options.baseUrl ?? 'https://danbooru.donmai.us/'
        this.baseUrl = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
        this.options = { ...options }
    }

    public async getPosts(tags: string | string[], options: GetPostsOptions = {}): Promise<Posts> {
        const { limit = 100, page = 0, id, changeId } = options
        const searchTags = Array.isArray(tags) ? [...tags] : [tags]

        if (id !== undefined) {
            searchTags.push(`id:${id}`)
        }

        if (changeId !== undefined) {
            throw new Error('Danbooru does not support changeId searches')
        }

        const query = searchTags.join(' ').trim()
        const url = this.createUrl('posts.json')
        url.searchParams.set('tags', query)
        url.searchParams.set('limit', String(limit))
        url.searchParams.set('page', String(page + 1))

        const data = await this.request(url)
        const items = this.parsePosts(data)
        const countUrl = this.createUrl('counts/posts.json')
        countUrl.searchParams.set('tags', query)
        const counts = z.object({ counts: z.object({ posts: z.number().int().nonnegative() }) })
            .parse(await this.request(countUrl))

        return { count: counts.counts.posts, offset: page * limit, items }
    }

    public async getRandomPost(tags: string | string[]): Promise<Post | undefined> {
        const url = this.createUrl('posts.json')
        url.searchParams.set('tags', Array.isArray(tags) ? tags.join(' ') : tags)
        url.searchParams.set('limit', '1')
        url.searchParams.set('random', 'true')

        return this.parsePosts(await this.request(url))[0]
    }

    public async autocompleteTags(query: string): Promise<Tag[]> {
        const url = this.createUrl('tags.json')
        url.searchParams.set('search[name_matches]', `${query}*`)
        url.searchParams.set('search[order]', 'count')
        url.searchParams.set('limit', '20')
        const tags = z.array(z.object({ name: z.string() })).parse(await this.request(url))

        return tags.map(tag => ({ label: tag.name, value: tag.name }))
    }

    private createUrl(path: string): URL {
        const url = new URL(path, this.baseUrl)

        if (this.options.apiKey !== undefined && this.options.login !== undefined) {
            url.searchParams.set('api_key', this.options.apiKey)
            url.searchParams.set('login', this.options.login)
        }

        return url
    }

    private async request(url: URL): Promise<unknown> {
        const response = await fetch(url, {
            headers: { 'User-Agent': this.options.userAgent ?? 'Nymph/1.0' }
        })

        if (!response.ok) {
            throw new Error(`Booru request failed with HTTP ${response.status}`)
        }

        return response.json()
    }

    private parsePosts(data: unknown): Post[] {
        return z.array(postSchema).parse(data).map(post => ({
            id: post.id,
            file_url: post.file_url ?? '',
            tags: post.tag_string,
            rating: post.rating,
            score: post.score,
            width: post.image_width,
            height: post.image_height,
            parent_id: post.parent_id?.toString(),
            sample_url: post.large_file_url ?? undefined,
            preview_url: post.preview_file_url ?? undefined,
            source: post.source,
            md5: post.md5 ?? undefined
        }))
    }
}

export class SonoharaClient extends DanBooruClient {
    public constructor(options: DanBooruClientOptions = {}) {
        super({ baseUrl: 'https://sonohara.donmai.us/', ...options })
    }
}
