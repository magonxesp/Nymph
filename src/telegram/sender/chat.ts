import type { Api } from "grammy"
import type { Message } from "grammy/types"
import type { TelegramSender, TelegramSendOptions } from "../sender.js"

export class TelegramChatSender implements TelegramSender {
	public constructor(
		private readonly api: Api,
		public readonly chatId: string | number
	) {}

	public sendMessage(text: string, options?: TelegramSendOptions): Promise<Message> {
		const hasOptions = options?.entities !== undefined || options?.reply_parameters !== undefined

		if (hasOptions) {
			return this.api.sendMessage(this.chatId, text, options)
		}

		return this.api.sendMessage(this.chatId, text)
	}

	public sendPhoto(url: string, options: TelegramSendOptions): Promise<Message> {
		if (options.reply_parameters === undefined) {
			return this.api.sendPhoto(this.chatId, url)
		}

		return this.api.sendPhoto(this.chatId, url, options)
	}

	public sendAnimation(url: string, options: TelegramSendOptions): Promise<Message> {
		if (options.reply_parameters === undefined) {
			return this.api.sendAnimation(this.chatId, url)
		}

		return this.api.sendAnimation(this.chatId, url, options)
	}

	public sendVideo(url: string, options: TelegramSendOptions): Promise<Message> {
		if (options.reply_parameters === undefined) {
			return this.api.sendVideo(this.chatId, url)
		}

		return this.api.sendVideo(this.chatId, url, options)
	}
}
