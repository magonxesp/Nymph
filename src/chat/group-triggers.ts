/**
 * Nymph
 * Copyright (C) 2026  MagonxESP
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export function compileGroupTriggers(contents: string): RegExp[] {
	return contents
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith('#'))
		.map((pattern) => {
			const expression = [...pattern]
				.map((character) => {
					if (character === '*') {
						return '.*'
					}

					if (character === '?') {
						return '.'
					}

					return character.replace(/[\\^$+?.()|[\]{}]/g, '\\$&')
				})
				.join('')

			return new RegExp(`^${expression}$`, 'isu')
		})
}

export function matchesGroupTrigger(text: string, triggers: RegExp[]): boolean {
	return triggers.some((trigger) => trigger.test(text))
}

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
		if (entity.type === 'text_mention') {
			return entity.user?.id === botId
		}

		if (entity.type === 'mention' && botUsername) {
			const mention = text.slice(entity.offset, entity.offset + entity.length)
			return mention.toLowerCase() === `@${botUsername.toLowerCase()}`
		}

		return false
	})
}
