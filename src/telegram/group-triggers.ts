export type GroupMentionEntity = {
	type: string
	offset: number
	length: number
	user?: { id: number }
}

export function mentionsBot(
	text: string,
	entities: GroupMentionEntity[],
	botId: number,
	botUsername?: string
): boolean {
	return entities.some((entity) => {
		if (entity.type === "text_mention") {
			return entity.user?.id === botId
		}

		if (entity.type === "mention" && botUsername) {
			const mention = text.slice(entity.offset, entity.offset + entity.length)
			return mention.toLowerCase() === `@${botUsername.toLowerCase()}`
		}

		return false
	})
}
