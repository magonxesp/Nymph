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

import { readFile } from "node:fs/promises"
import path from "node:path"
import { ChatOpenAI } from "@langchain/openai"
import { createAgent, providerStrategy } from "langchain"
import { groupResponseSchema } from "../chat/group.js"
import { privateResponseSchema } from "../chat/response.js"
import { chatModel, openAIApiKey, promptsDir } from "../env.js"
import { loadSkills, skills } from "./skill.js"
import tools from "./tools.js"
import { log } from "../logging.js"

export { createMemoryAgent } from "./memory.js"

const behaviorSystemPrompt = await readFile(path.join(promptsDir, "behavior.md"), "utf8")
const availableSkills = await loadSkills()
const skillList = JSON.stringify(availableSkills, undefined, 2)

const skillIndex = skills.size > 0
    ? `Skills disponibles (carga solo las necesarias con get_skill):\n${skillList}`
    : "No hay skills adicionales disponibles."

if (!openAIApiKey) {
    throw new Error("NYMPH_OPENAI_API_KEY is required")
}

log.info({ skills: availableSkills.map(skill => skill.name) }, "Skills loaded")

export async function createPrivateChatAgent() {
    const privateResponsePrompt = await readFile(path.join(promptsDir, "private-response.md"), "utf8")

    const systemPrompt = [
        behaviorSystemPrompt,
        privateResponsePrompt,
        skillIndex
    ].filter(Boolean).join("\n\n")

    log.debug({ systemPrompt }, "System prompt built")

    return createAgent({
        model: new ChatOpenAI({
            apiKey: openAIApiKey,
            model: chatModel,
            useResponsesApi: true,
            reasoning: {
                effort: "low",
                summary: "auto"
            },
            verbosity: "low"
        }),
        tools,
        systemPrompt,
        responseFormat: providerStrategy({ schema: privateResponseSchema, strict: true }),
    })
}

export async function createGroupChatAgent() {
    const groupResponsePrompt = await readFile(path.join(promptsDir, "group-response.md"), "utf8")

    const systemPrompt = [
        behaviorSystemPrompt,
        groupResponsePrompt,
        skillIndex
    ].filter(Boolean).join("\n\n")

    log.debug({ systemPrompt }, "System prompt built")

    return createAgent({
        model: new ChatOpenAI({
            apiKey: openAIApiKey,
            model: chatModel,
            useResponsesApi: true,
            reasoning: {
                effort: "low",
                summary: "auto"
            },
            verbosity: "low"
        }),
        tools,
        systemPrompt,
        responseFormat: providerStrategy({ schema: groupResponseSchema, strict: true }),
    })
}
