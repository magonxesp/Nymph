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

import { XMLParser } from 'fast-xml-parser'
import { SyntaxValidator } from 'fast-xml-validator'
import { rule34ApiKey, rule34UserId } from "./env.js";

const pageSize = 100
const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true,
    isArray: (_tagName, path) => path === 'posts.post'
})

export type Post = {
    id: number
    file_url: string
    tags: string
    rating: string
    score: number
    height?: number
    width?: number
    parent_id?: string
    sample_url?: string
    sample_width?: number
    sample_height?: number
    preview_url?: string
    preview_width?: number
    preview_height?: number
    change?: number
    md5?: string
    creator_id?: number
    has_children?: boolean
    created_at?: string
    status?: string
    source?: string
    has_notes?: boolean
    has_comments?: boolean
}

export type Posts = {
    count: number
    offset: number
    items: Post[]
}

export type Tag = {
    label: string
    value: string
}

export type GetPostsOptions = {
    limit?: number
    page?: number
    id?: number
    changeId?: number
}

export type ClientOptions = {
    baseUrl?: string
    apiKey?: string
    userId?: string
}

type ParsedPosts = Omit<Posts, 'items'> & {
    post?: Post[]
    success?: boolean
    reason?: string
}

export class Client {
    private readonly baseUrl: URL
    private readonly apiKey?: string
    private readonly userId?: string

    public constructor(options: ClientOptions = {}) {
        const { baseUrl, apiKey, userId } = options

        if (!baseUrl) {
            throw new Error('Booru baseUrl must be a provided')
        }

        const hasOneCredential = (apiKey === undefined) !== (userId === undefined)

        if (hasOneCredential) {
            throw new Error('Booru apiKey and userId must be provided together')
        }

        this.baseUrl = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
        this.apiKey = apiKey
        this.userId = userId
    }

    public async getPosts(tags: string | string[], options: GetPostsOptions = {}): Promise<Posts> {
        const { limit = pageSize, page = 0, id, changeId } = options
        const url = new URL('index.php', this.baseUrl)
        url.searchParams.set('page', 'dapi')
        url.searchParams.set('s', 'post')
        url.searchParams.set('q', 'index')
        url.searchParams.set('tags', Array.isArray(tags) ? tags.join(' ') : tags)
        url.searchParams.set('limit', String(limit))
        url.searchParams.set('pid', String(page))

        if (id !== undefined) {
            url.searchParams.set('id', String(id))
        }

        if (changeId !== undefined) {
            url.searchParams.set('cid', String(changeId))
        }

        if (this.apiKey !== undefined && this.userId !== undefined) {
            url.searchParams.set('api_key', this.apiKey)
            url.searchParams.set('user_id', this.userId)
        }

        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Booru request failed with HTTP ${response.status}`)
        }

        return this.parsePosts(await response.text())
    }

    public async getRandomPost(tags: string | string[]): Promise<Post | undefined> {
        const firstPage = await this.getPosts(tags, { limit: pageSize })

        if (firstPage.count === 0 || firstPage.items.length === 0) {
            return undefined
        }

        const randomIndex = Math.floor(Math.random() * firstPage.count)
        const page = Math.floor(randomIndex / pageSize)
        const posts = page === 0
            ? firstPage
            : await this.getPosts(tags, { limit: pageSize, page })

        return posts.items[randomIndex % pageSize]
    }

    public async autocompleteTags(query: string): Promise<Tag[]> {
        const url = new URL('autocomplete.php', this.baseUrl)
        url.searchParams.set('q', query)

        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Booru request failed with HTTP ${response.status}`)
        }

        const body = await response.text()
        const data: unknown = body.trim() === '' ? [] : JSON.parse(body)

        if (!Array.isArray(data)) {
            throw new Error('Invalid booru autocomplete response')
        }

        return data as Tag[]
    }

    protected parsePosts(xml: string): Posts {
        if (xml.trim() === '') {
            return { count: 0, offset: 0, items: [] }
        }

        try {
            SyntaxValidator.validate(xml, { multipleRoots: false })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            throw new Error(`Invalid booru XML: ${message}`, { cause: error })
        }

        const document = xmlParser.parse(xml) as { posts?: ParsedPosts }
        const posts = document.posts

        if (!posts) {
            throw new Error('Invalid booru posts response')
        }

        if (posts.success === false) {
            throw new Error(`Booru search failed: ${posts.reason ?? 'unknown error'}`)
        }

        return {
            count: posts.count,
            offset: posts.offset,
            items: posts.post ?? []
        }
    }
}

export class Rule34Client extends Client {
    constructor(options: ClientOptions = {}) {
        super({
            baseUrl: 'https://api.rule34.xxx/',
            apiKey: rule34ApiKey,
            userId: rule34UserId,
            ...options,
        });
    }
}
