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

import { tool } from "langchain"
import { z } from "zod"
import { log } from "../logging.js"
import { createMemoryHistory } from "./history.js"
import { ChatId } from "../chat/id.js"
import { getChatHistorySnapshot } from "../chat/snapshot.js"
import { getConfiguredChat } from "../chat/configuration.js"
import { MemoryContent } from "./content.js"
import { embedMemoryTexts } from "./embedding.js"
import { MemoryId } from "./id.js"
import type { Memory } from "./memory.js"
import { MemoryRepository } from "./repository.js"
import { generateMemories } from "./memory.js"

const repository = new MemoryRepository()

function memoryResult(memory: Memory) {
	return { id: memory.id.value, content: memory.content.value }
}

function memoryError(error: unknown, toolName: string) {
	log.warn({ err: error, tool: toolName }, "Memory tool failed")
	return {
		error: "No se pudo completar la operación de memoria. No confirmes que se haya realizado."
	}
}

export const createMemory = tool(
	async ({ focus }, runtime) => {
		try {
			const chat = getConfiguredChat(runtime)
			const snapshot = getChatHistorySnapshot(chat)
			const generated = await generateMemories(createMemoryHistory(snapshot), focus, {
				callbacks: runtime.callbacks,
				signal: runtime.signal
			})

			if (generated.length === 0) {
				return { memories: [] }
			}

			const memories = await repository.insertMany(snapshot.chatId, generated)

			return { memories: memories.map(memoryResult) }
		} catch (error) {
			return memoryError(error, "create_memory")
		}
	},
	{
		name: "create_memory",
		description:
			"Llama al agente de recuerdos para extraer y guardar información duradera del historial real del chat actual. Úsala ante una petición de recordar o hechos importantes, no en cada turno. Puede no encontrar nada que guardar. No está disponible durante la ejecución de una tarea en segundo plano, que no tiene el historial.",
		schema: z
			.object({
				focus: z
					.string()
					.min(1)
					.nullable()
					.describe(
						"Tema del historial que se quiere recordar; null para evaluar todo el lote. No inventes información."
					)
			})
			.strict()
	}
)

export const queryMemories = tool(
	async ({ query, limit }, runtime) => {
		try {
			const chat = getConfiguredChat(runtime)
			const [embedding] = await embedMemoryTexts([query])
			const results = await repository.search(new ChatId(chat.id, chat.platform), embedding, limit)

			return {
				memories: results.map(({ memory, distance }) => ({
					...memoryResult(memory),
					distance
				}))
			}
		} catch (error) {
			return memoryError(error, "query_memories")
		}
	},
	{
		name: "query_memories",
		description:
			"Busca recuerdos por significado dentro del chat actual. Devuelve ID, texto y distancia coseno: cuanto menor, más cercano. Comprueba la relevancia del texto; una coincidencia no garantiza que responda a la pregunta.",
		schema: z
			.object({
				query: z.string().min(1).describe("Consulta en lenguaje natural sobre lo que necesitas recordar"),
				limit: z.number().int().min(1).max(20).default(5).describe("Máximo de recuerdos a recuperar")
			})
			.strict()
	}
)

export const editMemory = tool(
	async ({ id, content }, runtime) => {
		try {
			const chat = getConfiguredChat(runtime)
			const memoryId = new MemoryId(id)
			const memoryContent = new MemoryContent(content)
			const [embedding] = await embedMemoryTexts([memoryContent.value])
			const memory = await repository.update(new ChatId(chat.id, chat.platform), memoryId, {
				content: memoryContent,
				embedding
			})

			if (!memory) {
				return {
					error: "No existe un recuerdo con ese ID en el chat actual."
				}
			}

			return { memory: memoryResult(memory) }
		} catch (error) {
			return memoryError(error, "edit_memory")
		}
	},
	{
		name: "edit_memory",
		description:
			"Corrige un recuerdo existente del chat actual y regenera su embedding. Usa un ID obtenido de query_memories o create_memory y un texto completo basado en una corrección confirmada en la conversación.",
		schema: z
			.object({
				id: z
					.string()
					.regex(/^[1-9][0-9]*$/)
					.describe("ID del recuerdo que se va a editar"),
				content: z.string().min(1).describe("Nuevo texto completo del recuerdo")
			})
			.strict()
	}
)

export const memoryTools = [createMemory, queryMemories, editMemory]
