import { afterEach, describe, expect, it, vi } from "vitest"
import { getCurrentDate } from "./tools.js"

afterEach(() => {
	vi.useRealTimers()
})

describe("get_current_date", () => {
	it("reads the current UTC date on every invocation, including across midnight", async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-10-27T23:59:59.000Z"))

		await expect(getCurrentDate.invoke({})).resolves.toBe("2026-10-27T23:59:59.000Z")

		vi.setSystemTime(new Date("2026-10-28T00:00:01.000Z"))

		await expect(getCurrentDate.invoke({})).resolves.toBe("2026-10-28T00:00:01.000Z")
	})
})
