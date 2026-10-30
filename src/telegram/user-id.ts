import type { User } from "grammy/types"
import { ChatPlatform } from "../chat/platform.js"
import { UserId } from "../chat/user-id.js"

export function toUserId(user: Pick<User, "id" | "first_name" | "last_name">): UserId {
	const name = [user.first_name, user.last_name].filter(Boolean).join(" ")
	return new UserId(String(user.id), name, ChatPlatform.Telegram)
}
