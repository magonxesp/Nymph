import "dotenv/config"
import { bot } from "./bot.js"
import { loadSkills } from "./agent/skill.js"

await loadSkills()
await bot.start()
