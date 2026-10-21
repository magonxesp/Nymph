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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { ChatId } from "../chat/id.js"
import { MemoryContent } from "./content.js"
import { Embedding } from "./embedding.js"
import { MemoryId } from "./id.js"

export type MemoryObject = {
    id: string
    chatId: string
    content: string
    embedding: number[] | null
    createdAt: Date
    updatedAt: Date
}

export class Memory {
    public readonly id: MemoryId
    public readonly chatId: ChatId
    public readonly content: MemoryContent
    public readonly embedding: Embedding | null
    public readonly createdAt: Date
    public readonly updatedAt: Date

    public constructor(data: MemoryObject) {
        this.id = new MemoryId(data.id)
        this.chatId = new ChatId(data.chatId)
        this.content = new MemoryContent(data.content)
        this.embedding = data.embedding === null ? null : new Embedding(data.embedding)
        this.createdAt = new Date(data.createdAt)
        this.updatedAt = new Date(data.updatedAt)

        if (Number.isNaN(this.createdAt.getTime())) {
            throw new Error("The memory creation date must be valid")
        }

        if (Number.isNaN(this.updatedAt.getTime())) {
            throw new Error("The memory update date must be valid")
        }
    }

}
