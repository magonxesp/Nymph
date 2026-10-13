import "dotenv/config"
import { bot } from "./bot.js"

bot.start().catch((error: unknown) => {
    console.error("Failed to start Telegram bot:", error)
    process.exitCode = 1
})
