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

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ChatOpenAI } from '@langchain/openai'
import { createAgent, providerStrategy } from 'langchain'
import { memoryModel, openAIApiKey, promptsDir } from '../env.js'
import { memoryResponseSchema } from '../memory/response.js'

export async function createMemoryAgent() {
	if (!openAIApiKey) {
		throw new Error('NYMPH_OPENAI_API_KEY is required')
	}

	const systemPrompt = await readFile(path.join(promptsDir, 'memory.md'), 'utf8')

	return createAgent({
		model: new ChatOpenAI({
			apiKey: openAIApiKey,
			model: memoryModel,
			useResponsesApi: true,
			reasoning: { effort: 'none' },
			verbosity: 'low'
		}),
		tools: [],
		systemPrompt,
		responseFormat: providerStrategy({
			schema: memoryResponseSchema,
			strict: true
		})
	})
}
