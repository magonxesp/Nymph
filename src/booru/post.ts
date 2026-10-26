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

export type GetPostsOptions = {
    limit?: number
    page?: number
    id?: number
    changeId?: number
}
