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
import {gelbooruApiKey, gelbooruUserId, rule34ApiKey, rule34UserId} from '../env.js'
import { XmlBooruClient } from './xmlbooru.js'
import type { GetPostsOptions, Posts } from './post.js'
import type { Tag } from './tag.js'

export type GelBooruClientOptions = {
    baseUrl?: string
    apiKey?: string
    userId?: string
}

export class GelBooruClient extends XmlBooruClient {
    private readonly apiKey?: string
    private readonly userId?: string

    public constructor(options: GelBooruClientOptions = {}) {
        const {
            baseUrl = 'https://gelbooru.com/',
            apiKey = gelbooruApiKey,
            userId = gelbooruUserId
        } = options

        if (!baseUrl) {
            throw new Error('Booru baseUrl must be provided')
        }

        const hasOneCredential = (apiKey === undefined) !== (userId === undefined)

        if (hasOneCredential) {
            throw new Error('Booru apiKey and userId must be provided together')
        }

        super(baseUrl)
        this.apiKey = apiKey
        this.userId = userId
    }

    public async getPosts(tags: string | string[], options: GetPostsOptions = {}): Promise<Posts> {
        const { limit = 100, page = 0, id, changeId } = options
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

    public async autocompleteTags(query: string): Promise<Tag[]> {
        const url = this.createAutocompleteUrl(query)

        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Booru request failed with HTTP ${response.status}`)
        }

        const body = await response.text()
        const data: unknown = body.trim() === '' ? [] : JSON.parse(body)

        if (!Array.isArray(data)) {
            throw new Error('Invalid booru autocomplete response')
        }

        return z.array(z.object({ label: z.string(), value: z.string() })).parse(data)
    }

    protected createAutocompleteUrl(query: string): URL {
        const url = new URL('index.php', this.baseUrl)
        url.searchParams.set('page', 'autocomplete2')
        url.searchParams.set('type', 'tag_query')
        url.searchParams.set('term', query)

        return url
    }
}

export class SafeBooruClient extends GelBooruClient {
    public constructor(options: GelBooruClientOptions = {}) {
        super({ baseUrl: 'https://safebooru.org/', ...options })
    }

    protected override createAutocompleteUrl(query: string): URL {
        const url = new URL('autocomplete.php', this.baseUrl)
        url.searchParams.set('q', query)

        return url
    }
}

export class Rule34Client extends GelBooruClient {
    public constructor(options: GelBooruClientOptions = {}) {
        super({
            baseUrl: 'https://api.rule34.xxx/',
            apiKey: rule34ApiKey,
            userId: rule34UserId,
            ...options
        })
    }

    protected override createAutocompleteUrl(query: string): URL {
        const url = new URL('autocomplete.php', this.baseUrl)
        url.searchParams.set('q', query)

        return url
    }
}
