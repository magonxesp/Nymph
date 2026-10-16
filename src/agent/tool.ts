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

import { tool } from "langchain";
import { skills } from "./skill.js";
import z from "zod";
import fs from "node:fs/promises"
import { Rule34Client } from "../booru.js"

const rule34Client = new Rule34Client()

export const readTextFile = tool(
    async ({ path }) => await fs.readFile(path),
    {
        name: "read_text_file",
        description: "Lee un fichero de texto",
        schema: z.object({ path: z.string().describe("Path al fichero") }),
    }
)

export const getSkill = tool(
    async ({ name }) => skills.get(name) ?? "Skill no disponible.",
    {
        name: "get_skill",
        description: "Carga las instrucciones completas de una skill disponible cuando la peticion del usuario lo requiera.",
        schema: z.object({ name: z.string().describe("Nombre de la skill") }),
    }
)

export const rule34AutocompleteTags = tool(
    async ({ tag }) => await rule34Client.autocompleteTags(tag),
    {
        name: "rule34_autocomplete_tags",
        description: "Busca sugerencias para un tag de Rule34. Usa el campo value de una sugerencia para buscar posts.",
        schema: z.object({ tag: z.string().min(1).describe("Tag incompleto que se quiere autocompletar") }),
    }
)

export const rule34RandomPost = tool(
    async ({ tag }) => {
        const post = await rule34Client.getRandomPost(tag)

        if (!post) {
            return `No se encontraron posts para el tag ${tag}.`
        }

        return post.file_url
    },
    {
        name: "rule34_random_post",
        description: "Devuelve la URL del archivo de un post aleatorio de Rule34 que tenga el tag indicado.",
        schema: z.object({ tag: z.string().min(1).describe("Tag de Rule34 usado para buscar el post") }),
    }
)

const tools = [
    getSkill,
    readTextFile,
    rule34AutocompleteTags,
    rule34RandomPost
]

export default tools
