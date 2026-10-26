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

import { GelBooruClient, SafeBooruClient, Rule34Client } from './gelbooru.js'
import { DanBooruClient, SonoharaClient } from './danbooru.js'
import { KonachanClient, KonachanNetClient, YandereClient } from './moebooru.js'
import type { GetPostsOptions, Post, Posts } from './post.js'
import type { Tag } from './tag.js'

export interface BooruClient {
    getPosts(tags: string | string[], options?: GetPostsOptions): Promise<Posts>
    getRandomPost(tags: string | string[]): Promise<Post | undefined>
    autocompleteTags(query: string): Promise<Tag[]>
}

export type BooruName =
    | 'gelbooru'
    | 'safebooru'
    | 'rule34'
    | 'danbooru'
    | 'sonohara'
    | 'konachan'
    | 'konachan.net'
    | 'yandere'

export const booruNames = [
    'gelbooru', 'safebooru', 'rule34', 'danbooru',
    'sonohara', 'konachan', 'konachan.net', 'yandere'
] as const satisfies readonly BooruName[]

export function getBooruClient(booru: BooruName): BooruClient {
    switch (booru) {
        case 'gelbooru':
            return new GelBooruClient()
        case 'safebooru':
            return new SafeBooruClient()
        case 'rule34':
            return new Rule34Client()
        case 'danbooru':
            return new DanBooruClient()
        case 'sonohara':
            return new SonoharaClient()
        case 'konachan':
            return new KonachanClient()
        case 'konachan.net':
            return new KonachanNetClient()
        case 'yandere':
            return new YandereClient()
        default:
            throw new Error(`Unsupported booru: ${booru}`)
    }
}
