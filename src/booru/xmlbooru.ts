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
import { z } from 'zod'
import type { BooruClient } from './client.js'
import type { GetPostsOptions, Post, Posts } from './post.js'
import type { Tag } from './tag.js'

const pageSize = 100
const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true,
    isArray: (_tagName, path) => path === 'posts.post'
})

type ParsedPosts = {
    count?: number
    offset?: number
    post?: Post[]
    success?: boolean
    reason?: string
}

const optionalText = z.union([z.string(), z.number()]).transform(String).optional()
const optionalBoolean = z.union([z.boolean(), z.literal(0), z.literal(1)])
    .transform(Boolean).optional()
const postSchema: z.ZodType<Post> = z.object({
    id: z.number().int(),
    file_url: z.string(),
    tags: z.string(),
    rating: z.string(),
    score: z.union([z.number(), z.literal('').transform(() => 0)]),
    height: z.number().optional(),
    width: z.number().optional(),
    parent_id: optionalText,
    sample_url: z.string().optional(),
    sample_width: z.number().optional(),
    sample_height: z.number().optional(),
    preview_url: z.string().optional(),
    preview_width: z.number().optional(),
    preview_height: z.number().optional(),
    change: z.number().optional(),
    md5: optionalText,
    creator_id: z.number().optional(),
    has_children: optionalBoolean,
    created_at: optionalText,
    status: z.string().optional(),
    source: optionalText,
    has_notes: optionalBoolean,
    has_comments: optionalBoolean
})
const parsedPostsSchema: z.ZodType<ParsedPosts> = z.object({
    count: z.number().int().nonnegative().optional(),
    offset: z.number().int().nonnegative().optional(),
    post: z.array(postSchema).optional(),
    success: z.boolean().optional(),
    reason: z.string().optional()
})

export abstract class XmlBooruClient implements BooruClient {
    protected readonly baseUrl: URL

    protected constructor(baseUrl: string) {
        this.baseUrl = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
    }

    public abstract getPosts(tags: string | string[], options?: GetPostsOptions): Promise<Posts>
    public abstract autocompleteTags(query: string): Promise<Tag[]>

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

        const data: unknown = xmlParser.parse(xml)
        const document = z.object({ posts: parsedPostsSchema }).safeParse(data)

        if (!document.success) {
            throw new Error('Invalid booru posts response')
        }

        const posts = document.data.posts

        if (posts.success === false) {
            throw new Error(`Booru search failed: ${posts.reason ?? 'unknown error'}`)
        }

        if (posts.count === undefined) {
            throw new Error('Invalid booru posts response')
        }

        return {
            count: posts.count,
            offset: posts.offset ?? 0,
            items: posts.post ?? []
        }
    }
}
