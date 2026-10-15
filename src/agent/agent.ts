import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ChatOpenAI } from "@langchain/openai"
import { createAgent, tool } from "langchain"
import { z } from "zod"
import { aiModel, openAIApiKey } from "../env.js"
import { getSkillTool, skills } from "./skill.js"

const root = fileURLToPath(new URL("../..", import.meta.url))
const references = path.join(root, "context", "character")

const [systemPrompt, contextIndex, referenceNames] = await Promise.all([
    readFile(path.join(root, "prompts", "system.md"), "utf8"),
    readFile(path.join(root, "prompts", "system-context.md"), "utf8"),
    readdir(references),
])

const allowedReferences = new Map(referenceNames.filter((name) => name.endsWith(".md"))
    .map((name) => [`context/character/${name}`, name]))

const getContext = tool(async ({ reference }) => {
    const filename = allowedReferences.get(reference)
    if (!filename) return "Referencia no disponible. Consulta el índice para elegir una ruta exacta."
    return readFile(path.join(references, filename), "utf8")
}, {
    name: "get_context",
    description: "Lee una referencia de personaje por su ruta exacta indicada en el índice de contexto.",
    schema: z.object({ reference: z.string().describe("Ruta exacta, por ejemplo context/character/nymph.md") }),
})


const skillIndex = skills.size > 0
    ? `Skills disponibles (carga solo las necesarias con get_skill):\n${[...skills.keys()].join("\n")}`
    : "No hay skills adicionales disponibles."

if (!openAIApiKey) {
    throw new Error("NYMPH_OPENAI_API_KEY is required")
}

export const agent = createAgent({
    model: new ChatOpenAI({
        apiKey: openAIApiKey,
        model: aiModel,
        useResponsesApi: true,
    }),
    tools: [getContext, getSkillTool],
    systemPrompt: `${systemPrompt}\n\n${contextIndex}\n\n${skillIndex}`,
})
