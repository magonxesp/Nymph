import type { Context } from "grammy"
import type { Message } from "grammy/types"
import type { TelegramSender, TelegramSendOptions } from "../sender.js"

export class TelegramContextSender implements TelegramSender {
	public readonly chatId: number | undefined

	public constructor(private readonly context: Context) {
		this.chatId = context.chat?.id
	}

	public sendMessage(text: string, options?: TelegramSendOptions): Promise<Message> {
		if (options === undefined) {
			return this.context.reply(text)
		}

		return this.context.reply(text, options)
	}

	public sendPhoto(url: string, options: TelegramSendOptions): Promise<Message> {
		return this.context.replyWithPhoto(url, options)
	}

	public sendAnimation(url: string, options: TelegramSendOptions): Promise<Message> {
		return this.context.replyWithAnimation(url, options)
	}

	public sendVideo(url: string, options: TelegramSendOptions): Promise<Message> {
		return this.context.replyWithVideo(url, options)
	}
}
