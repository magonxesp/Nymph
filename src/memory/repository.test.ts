import { ChatPlatform } from "../chat/platform.js"
import { readFile } from "node:fs/promises"
import { afterAll, describe, expect, it } from "vitest"
import { ChatId } from "../chat/id.js"
import { database } from "../database.js"
import { MemoryContent } from "./content.js"
import { Embedding } from "./embedding.js"
import { MemoryRepository } from "./repository.js"

describe.runIf(process.env.NYMPH_TEST_POSTGRES === "1")("MemoryRepository integration", () => {
	afterAll(async () => database.destroy())

	it("stores the native chat ID and platform separately and isolates memory operations", async () => {
		await database.transaction(async (connection) => {
			const sql = await readFile(new URL("../../sql/squema.sql", import.meta.url), "utf8")
			await connection.raw(
				sql
					.replace("CREATE TABLE IF NOT EXISTS tasks", "CREATE TEMP TABLE tasks")
					.replace("CREATE TABLE IF NOT EXISTS chat_memories", "CREATE TEMP TABLE chat_memories")
			)
			const repository = new MemoryRepository(connection)
			const chatId = new ChatId("123", ChatPlatform.Telegram)
			const otherChatId = new ChatId("456", ChatPlatform.Telegram)
			const input = { content: new MemoryContent("Nymph usa TypeScript"), embedding: new Embedding([1, 0, 0]) }
			const memory = await repository.insert(chatId, input)
			const [otherMemory] = await repository.insertMany(otherChatId, [input])

			expect(memory.chatId).toEqual(chatId)
			expect(otherMemory.chatId).toEqual(otherChatId)
			expect(
				await connection("chat_memories").select("chat_id", "platform").where("id", memory.id.value).first()
			).toEqual({ chat_id: chatId.value, platform: chatId.platform })

			await connection("chat_memories").insert({
				chat_id: chatId.value,
				platform: "unknown",
				content: input.content.value,
				embedding: "[1,0,0]"
			})
			const results = await repository.search(chatId, input.embedding)

			expect(results.map(({ memory }) => memory.id)).toEqual([memory.id])
			expect(await repository.update(otherChatId, memory.id, input)).toBeUndefined()
			expect(await repository.delete(otherChatId, memory.id)).toBe(false)
			expect((await repository.update(chatId, memory.id, input))?.chatId).toEqual(chatId)
			expect(await repository.delete(chatId, memory.id)).toBe(true)
			expect(await repository.search(chatId, input.embedding)).toEqual([])
			await connection.raw("DROP TABLE pg_temp.tasks")
			await connection.raw("DROP TABLE pg_temp.chat_memories")
		})
	})
})
