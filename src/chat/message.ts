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

import { AIMessage, HumanMessage } from '@langchain/core/messages'
import type { ChatFile } from './attachment.js'
import type { ChatMessage } from './chat.js'

export function toModelMessage(message: ChatMessage): AIMessage | HumanMessage {
	if (message.role === 'user') {
		return toHumanMessage(message.content, message.images, message.files)
	}

	if (message.images?.length) {
		// Assistant output messages cannot carry input images in the Responses API.
		return toHumanMessage(`Contenido multimedia enviado por el asistente: ${message.content}`, message.images)
	}

	return new AIMessage(message.content)
}

export function toHumanMessage(text: string, images: string[] = [], files: ChatFile[] = []): HumanMessage {
	if (images.length === 0 && files.length === 0) {
		return new HumanMessage(text)
	}

	return new HumanMessage({
		content: [
			{ type: 'text', text },
			...images.map((url) => ({
				type: 'image_url' as const,
				image_url: { url }
			})),
			...files.map((file) => ({
				type: 'input_file' as const,
				filename: file.filename,
				file_data: `data:${file.mimeType};base64,${file.data}`
			}))
		]
	})
}
