import type { ChatReference } from "./snapshot.js"

export type ChatConfiguration = {
	configurable?: {
		chat?: ChatReference
	}
}

export function getConfiguredChat(config: ChatConfiguration): ChatReference {
	const chat = config.configurable?.chat

	if (chat === undefined) {
		throw new Error("Chat configuration is required")
	}

	return chat
}
