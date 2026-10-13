import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ChatOpenAI } from "@langchain/openai"
import { createAgent, tool } from "langchain"
import { z } from "zod"

const root = fileURLToPath(new URL("..", import.meta.url))
const references = path.join(root, "context", "character")
const skillsDirectory = path.join(root, "skills")

async function loadSkills(): Promise<Map<string, string>> {
    const skills = new Map<string, string>()
    let entries: string[]
    try {
        entries = await readdir(skillsDirectory)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return skills
        throw error
    }
    for (const name of entries.filter((entry) => entry.endsWith(".md"))) {
        skills.set(name.slice(0, -3), await readFile(path.join(skillsDirectory, name), "utf8"))
    }
    return skills
}

const apiKey = process.env.NYMPH_OPENAI_API_KEY

if (!apiKey) {
    throw new Error("NYMPH_OPENAI_API_KEY is required")
}

const [systemPrompt, contextIndex, skills, referenceNames] = await Promise.all([
    readFile(path.join(root, "prompts", "system.md"), "utf8"),
    readFile(path.join(root, "prompts", "system-context.md"), "utf8"),
    loadSkills(),
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

const getSkill = tool(async ({ name }) => skills.get(name) ?? "Skill no disponible.", {
    name: "get_skill",
    description: "Carga las instrucciones completas de una skill disponible cuando la tarea lo requiera.",
    schema: z.object({ name: z.string().describe("Nombre de la skill sin .md") }),
})

const skillIndex = skills.size > 0
    ? `Skills disponibles (carga solo las necesarias con get_skill):\n${[...skills.keys()].join("\n")}`
    : "No hay skills adicionales disponibles."

export const agent = createAgent({
    model: new ChatOpenAI({
        apiKey,
        model: process.env.NYMPH_OPENAI_MODEL ?? "gpt-6-luna",
        useResponsesApi: true,
    }),
    tools: [getContext, getSkill],
    systemPrompt: `${systemPrompt}\n\n${contextIndex}\n\n${skillIndex}`,
})
