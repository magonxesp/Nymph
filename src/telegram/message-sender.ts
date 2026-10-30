import type { Api, Context } from "grammy"
import type { User } from "grammy/types"
import { ChatId } from "../chat/id.js"
import { ChatPlatform } from "../chat/platform.js"
import type { MessageSender } from "../messaging/sender.js"
import type { OutgoingMessage, SentMessage } from "../messaging/message.js"
import { getTelegramApi } from "./api.js"
import { createGroupMessage } from "./group-message.js"
import { toTelegramResponse } from "./outgoing-message.js"
import { sendResponse } from "./response.js"
import type { TelegramSender } from "./sender.js"
import { TelegramChatSender } from "./sender/chat.js"
import { TelegramContextSender } from "./sender/context.js"

type BotIdentity = Pick<User, "id" | "first_name" | "last_name">

export class TelegramMessageSender implements MessageSender {
	private readonly transport: TelegramSender
	private readonly getIdentity: () => Promise<BotIdentity>

	public constructor(
		public readonly chatId: ChatId,
		api?: Api,
		context?: Context
	) {
		if (chatId.platform !== ChatPlatform.Telegram) {
			throw new Error("Telegram sender requires a Telegram chat ID")
		}

		if (context !== undefined) {
			if (String(context.chat?.id) !== chatId.value) {
				throw new Error("Telegram context does not match the destination chat")
			}

			this.transport = new TelegramContextSender(context)
			this.getIdentity = async () => context.me
		} else {
			const telegramApi = api ?? getTelegramApi()
			this.transport = new TelegramChatSender(telegramApi, chatId.value)
			this.getIdentity = () => telegramApi.getMe()
		}
	}

	public static fromContext(context: Context): TelegramMessageSender {
		if (context.chat === undefined) {
			throw new Error("Telegram context has no chat")
		}

		return new TelegramMessageSender(
			new ChatId(String(context.chat.id), ChatPlatform.Telegram),
			context.api,
			context
		)
	}

	public async *send(message: OutgoingMessage): AsyncGenerator<SentMessage> {
		const response = toTelegramResponse(message)
		const me = await this.getIdentity()

		for await (const sent of sendResponse(this.transport, response)) {
			yield {
				message: createGroupMessage({ me, message: sent.message }, "assistant", {
					text: sent.text,
					mentions: sent.isText ? response.mentions : []
				}),
				isText: sent.isText
			}
		}
	}
}
