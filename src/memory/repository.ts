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

import type { Knex } from "knex"
import pgvector from "pgvector"
import { z } from "zod"
import { database } from "../database.js"
import type { ChatId } from "../chat/id.js"
import type { MemoryContent } from "./content.js"
import type { Embedding } from "./embedding.js"
import type { MemoryId } from "./id.js"
import { Memory } from "./memory.js"

export type MemoryInput = {
    content: MemoryContent
    embedding: Embedding
}

export type MemorySearchResult = {
    memory: Memory
    distance: number
}

const memoryRowSchema = z.object({
    id: z.string(),
    chat_id: z.string(),
    content: z.string(),
    embedding: z.string().nullable()
        .transform(value => pgvector.fromSql(value))
        .pipe(z.array(z.number()).nullable()),
    created_at: z.date(),
    updated_at: z.date()
})

const searchResultRowSchema = memoryRowSchema.extend({
    distance: z.number()
})

const searchLimitSchema = z.number().int().positive()

function toMemory(memory: z.infer<typeof memoryRowSchema>): Memory {
    return new Memory({
        id: memory.id,
        chatId: memory.chat_id,
        content: memory.content,
        embedding: memory.embedding,
        createdAt: memory.created_at,
        updatedAt: memory.updated_at
    })
}

export class MemoryRepository {
    public constructor(private readonly connection: Knex = database) {}

    public async insert(chatId: ChatId, input: MemoryInput): Promise<Memory> {
        const now = new Date()
        const rows: unknown[] = await this.connection("chat_memories")
            .insert({
                chat_id: chatId.value,
                content: input.content.value,
                embedding: pgvector.toSql([...input.embedding.value]),
                created_at: now,
                updated_at: now
            })
            .returning("*")

        return toMemory(memoryRowSchema.parse(rows[0]))
    }

    public async search(chatId: ChatId, embedding: Embedding, limit = 5): Promise<MemorySearchResult[]> {
        const validatedLimit = searchLimitSchema.parse(limit)
        const distance = this.connection.raw("?? <=> ?::vector", [
            "embedding",
            pgvector.toSql([...embedding.value])
        ])
        const rows: unknown[] = await this.connection("chat_memories")
            .select("*", this.connection.raw("? AS distance", [distance]))
            .where("chat_id", chatId.value)
            .whereNotNull("embedding")
            .orderBy(distance, "asc")
            .limit(validatedLimit)

        return rows.map(row => {
            const result = searchResultRowSchema.parse(row)

            return {
                memory: toMemory(result),
                distance: result.distance
            }
        })
    }

    public async update(chatId: ChatId, id: MemoryId, input: MemoryInput): Promise<Memory | undefined> {
        const rows: unknown[] = await this.connection("chat_memories")
            .where({ chat_id: chatId.value, id: id.value })
            .update({
                content: input.content.value,
                embedding: pgvector.toSql([...input.embedding.value]),
                updated_at: new Date()
            })
            .returning("*")

        if (rows.length === 0) {
            return undefined
        }

        return toMemory(memoryRowSchema.parse(rows[0]))
    }

    public async delete(chatId: ChatId, id: MemoryId): Promise<boolean> {
        const deletedCount = await this.connection("chat_memories")
            .where({ chat_id: chatId.value, id: id.value })
            .delete()

        return deletedCount > 0
    }
}
