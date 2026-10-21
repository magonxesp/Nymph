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

import { fileURLToPath } from "node:url";
import path from "node:path"

export const rootDir = path.resolve(path.join(path.dirname(fileURLToPath(new URL(import.meta.url))), '..'))
export const skillsDir = process.env.NYMPH_SKILLS_DIR ?? path.join(rootDir, 'skills')
export const promptsDir = process.env.NYMPH_PROMPTS_DIR ?? path.join(rootDir, 'prompts')
export const openAIApiKey = process.env.NYMPH_OPENAI_API_KEY
export const aiModel = process.env.NYMPH_AI_MODEL ?? "gpt-6-luna"
export const rule34ApiKey = process.env.NYMPH_RULE34_API_KEY
export const rule34UserId = process.env.NYMPH_RULE34_USER_ID
