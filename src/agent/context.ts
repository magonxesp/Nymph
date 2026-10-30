import path from "node:path"
import { promptsDir } from "../env.js"
import { log } from "../logging.js"
import { loadSkills, skills } from "./skill.js"
import { readFileSync } from "node:fs"

export const behaviorSystemPrompt = readFileSync(path.join(promptsDir, "behavior.md"), "utf8")
const availableSkills = await loadSkills()
const skillList = JSON.stringify(availableSkills, undefined, 2)

export const skillIndex =
	skills.size > 0
		? `Skills disponibles (carga solo las necesarias con get_skill):\n${skillList}`
		: "No hay skills adicionales disponibles."

log.info({ skills: availableSkills.map((skill) => skill.name) }, "Skills loaded")
