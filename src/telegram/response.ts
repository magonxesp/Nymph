import type { Context } from "grammy"
import type { MessageEntity } from "grammy/types"
import type { ResponseMedia } from "../chat/response.js"
import { log } from "../logging.js"

type TelegramResponse = {
    text: string
    media: ResponseMedia[]
    entities?: MessageEntity[]
    replyToMessageId?: number
}

export async function* sendTelegramResponse(ctx: Context, response: TelegramResponse) {
    const replyOptions = {
        reply_parameters: response.replyToMessageId === undefined
            ? undefined
            : { message_id: response.replyToMessageId, allow_sending_without_reply: true }
    }

    if (response.text.trim()) {
        const message = response.entities === undefined && response.replyToMessageId === undefined
            ? await ctx.reply(response.text)
            : await ctx.reply(response.text, { ...replyOptions, entities: response.entities })
        yield { message, text: response.text, isText: true }
    }

    for (const media of response.media) {
        let message

        try {
            switch (media.type) {
                case "photo":
                    message = await ctx.replyWithPhoto(media.url, replyOptions)
                    break
                case "animation":
                    message = await ctx.replyWithAnimation(media.url, replyOptions)
                    break
                case "video":
                    message = await ctx.replyWithVideo(media.url, replyOptions)
                    break
            }
        } catch (error) {
            log.warn({ err: error, chatId: ctx.chat?.id }, "Failed to send Telegram media; sending original URL")
            message = await ctx.reply(media.url, replyOptions)
        }

        yield { message, text: media.url, isText: false }
    }
}
