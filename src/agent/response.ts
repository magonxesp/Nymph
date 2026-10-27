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

export function getAnswer(content: unknown): string {
	if (typeof content === "string") {
		return content
	}

	if (!Array.isArray(content)) {
		return ""
	}

	const text: string[] = []

	for (const block of content) {
		if (typeof block === "object" && block !== null && "text" in block && typeof block.text === "string") {
			text.push(block.text)
		}
	}

	return text.join("")
}

export function getContentTypes(content: unknown): unknown {
	if (!Array.isArray(content)) {
		return typeof content
	}

	return content.map((block) => {
		if (typeof block === "object" && block !== null && "type" in block) {
			return block.type
		}

		return typeof block
	})
}
