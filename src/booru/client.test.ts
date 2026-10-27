import { describe, expect, it } from "vitest"
import { booruNames, getBooruClient } from "./client.js"
import { GelBooruClient, SafeBooruClient, Rule34Client } from "./gelbooru.js"
import { DanBooruClient, SonoharaClient } from "./danbooru.js"
import { KonachanClient, KonachanNetClient, YandereClient } from "./moebooru.js"
import type { BooruName } from "./client.js"
import type { BooruClient } from "./client.js"

const clientClasses: Record<BooruName, new () => BooruClient> = {
	gelbooru: GelBooruClient,
	safebooru: SafeBooruClient,
	rule34: Rule34Client,
	danbooru: DanBooruClient,
	sonohara: SonoharaClient,
	konachan: KonachanClient,
	"konachan.net": KonachanNetClient,
	yandere: YandereClient
}

describe("getBooruClient", () => {
	it.each(booruNames)("selects the client for %s", (booru) => {
		expect(getBooruClient(booru)).toBeInstanceOf(clientClasses[booru])
	})
})
