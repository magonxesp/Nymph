import { fileURLToPath } from "node:url";
import path from "node:path"

export const rootDir = path.dirname(fileURLToPath(new URL(import.meta.url)))
export const skillsDir = process.env.NYMPH_SKILLS_DIR ?? path.join(rootDir, 'skills')
export const openAIApiKey = process.env.NYMPH_OPENAI_API_KEY
export const aiModel = process.env.NYMPH_AI_MODEL ?? "gpt-6-luna"
