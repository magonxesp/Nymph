import { describe, expect, it } from "vitest"
import { ChatPlatform } from "./platform.js"
import { UserId } from "./user-id.js"

describe("UserId", () => {
	it("keeps the opaque ID, display name and platform together", () => {
		const user = new UserId("user:ana", "Ana García 🦋", ChatPlatform.Telegram)

		expect(user.value).toBe("user:ana")
		expect(user.name).toBe("Ana García 🦋")
		expect(user.platform).toBe(ChatPlatform.Telegram)
	})

	it.each(["", "   "])("rejects blank IDs and names (%j)", (blank) => {
		expect(() => new UserId(blank, "Ana", ChatPlatform.Telegram)).toThrow("user ID")
		expect(() => new UserId("1", blank, ChatPlatform.Telegram)).toThrow("user name")
	})

	it("restores a serialized identity and validates unknown input", () => {
		const user = UserId.fromUnknown({ value: "1", name: "Ana", platform: "telegram" })

		expect(user).toBeInstanceOf(UserId)
		expect(user).toEqual(new UserId("1", "Ana", ChatPlatform.Telegram))
		for (const data of ["1", null, { value: "1" }, { value: 1, name: "Ana", platform: "telegram" }]) {
			expect(() => UserId.fromUnknown(data)).toThrow()
		}
		expect(() => UserId.fromUnknown({ value: "1", name: "Ana", platform: "unknown" })).toThrow()
	})
})
