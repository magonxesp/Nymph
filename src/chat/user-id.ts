import { z } from "zod"
import { ChatPlatform } from "./platform.js"

export type UserIdData = {
	value: string
	name: string
	platform: ChatPlatform
}

const userIdSchema = z.object({
	value: z.string(),
	name: z.string(),
	platform: z.enum(ChatPlatform)
}) satisfies z.ZodType<UserIdData>

export class UserId {
	public constructor(
		public readonly value: string,
		public readonly name: string,
		public readonly platform: ChatPlatform
	) {
		this.validate()
	}

	public static fromUnknown(value: unknown): UserId {
		const data = userIdSchema.parse(value)
		return new UserId(data.value, data.name, data.platform)
	}

	private validate(): void {
		if (this.value.trim().length === 0) {
			throw new Error("The user ID must not be blank")
		}

		if (this.name.trim().length === 0) {
			throw new Error("The user name must not be blank")
		}
	}
}
