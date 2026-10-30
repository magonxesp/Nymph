import { Api } from "grammy"

let api: Api | undefined

export function getTelegramApi(): Api {
	if (api === undefined) {
		const token = process.env.NYMPH_TELEGRAM_TOKEN
		if (!token) {
			throw new Error("NYMPH_TELEGRAM_TOKEN is required")
		}
		api = new Api(token)
	}
	return api
}
