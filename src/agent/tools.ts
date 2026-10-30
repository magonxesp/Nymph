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
import { skills } from "./skill.js"
import z from "zod"
import fs from "node:fs/promises"
import { editMemory, queryMemories, memoryTools } from "../memory/tools.js"
import { browserResearch } from "./browser.js"
import { booruTools } from "../booru/tools.js"
import { getCurrentDate } from "../time/tools.js"
import { taskTools } from "../task/tools.js"

export const readTextFile = tool(async ({ path }) => await fs.readFile(path), {
	name: "read_text_file",
	description: "Lee un fichero de texto",
	schema: z.object({ path: z.string().describe("Path al fichero") })
})

export const getSkill = tool(async ({ name }) => skills.get(name) ?? "Skill no disponible.", {
	name: "get_skill",
	description:
		"Carga las instrucciones completas de una skill disponible cuando la peticion del usuario lo requiera.",
	schema: z.object({ name: z.string().describe("Nombre de la skill") })
})

const tools = [getSkill, readTextFile, getCurrentDate, ...booruTools, ...memoryTools, ...taskTools]

export const taskAgentTools = [
	getSkill,
	readTextFile,
	getCurrentDate,
	queryMemories,
	editMemory,
	browserResearch,
	...booruTools
]

export default tools
