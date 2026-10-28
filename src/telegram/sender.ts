import type { Message, MessageEntity, ReplyParameters } from "grammy/types"

export type TelegramSendOptions = {
	entities?: MessageEntity[]
	reply_parameters?: ReplyParameters
}

export interface TelegramSender {
	readonly chatId: string | number | undefined
	sendMessage(text: string, options?: TelegramSendOptions): Promise<Message>
	sendPhoto(url: string, options: TelegramSendOptions): Promise<Message>
	sendAnimation(url: string, options: TelegramSendOptions): Promise<Message>
	sendVideo(url: string, options: TelegramSendOptions): Promise<Message>
}
