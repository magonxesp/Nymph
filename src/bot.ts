import { Bot } from "grammy"
import { agent } from "./llm/agents.js"
import { getAnswer, getContentTypes } from "./llm/response.js"
import { log } from "./logging.js"
import { PinoLangChainHandler } from "./llm/logging.js"

const token = process.env.NYMPH_TELEGRAM_TOKEN

if (!token) {
    throw new Error("NYMPH_TELEGRAM_TOKEN is required")
}

export const bot = new Bot(token)
const history = new Map<number, Array<{ role: "user" | "assistant", content: string }>>()

bot.command("start", async (ctx) => {
    await ctx.reply("Hola 😊")
})

bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id
    const previous = history.get(chatId) ?? []

    try {
        const messages = [...previous, { role: "user" as const, content: ctx.message.text }]
        const result = await agent.invoke({ messages }, { callbacks: [new PinoLangChainHandler(chatId)] })
        const last = result.messages.at(-1)
        const content = last?.content
        const answer = getAnswer(content)

        if (!answer.trim()) {
            log.warn({
                chatId,
                messageType: last?._getType(),
                contentTypes: getContentTypes(content),
                responseMetadata: last?.response_metadata,
                usageMetadata: last && "usage_metadata" in last ? last.usage_metadata : undefined,
            }, "Model returned no text")

            throw new Error("The model returned an empty answer")
        }

        await ctx.reply(answer)
        history.set(chatId, [...messages, { role: "assistant" as const, content: answer }].slice(-20))
    } catch (error) {
        log.error({ err: error, chatId }, "Failed to answer Telegram message")
        await ctx.reply("No he podido responder ahora. Inténtalo de nuevo en un momento.")
    }
})
