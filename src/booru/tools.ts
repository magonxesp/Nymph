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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { booruNames, getBooruClient } from './client.js'
import type { BooruName } from './client.js'
import type { Post } from './post.js'
import { downloadImages } from '../media/remote.js'
import { log } from '../logging.js'
import { Rule34Client } from './gelbooru.js'

const rule34Client = new Rule34Client()

type ImageContent = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

const booruSchema = z
	.enum(booruNames)
	.exclude(['rule34'])
	.describe('Image board: konachan corresponde a konachan.com y yandere a yande.re')
const tagSchema = z.string().trim().min(1).describe('Tag o tags separados por espacios para la búsqueda')

async function postImages(booru: BooruName, post: Post): Promise<ImageContent[]> {
	const content: ImageContent[] = [{ type: 'text', text: JSON.stringify({ booru, post }) }]
	const url = post.file_url || post.sample_url || post.preview_url

	if (!url) {
		content.push({
			type: 'text',
			text: 'El post no tiene una imagen accesible.'
		})
		return content
	}

	try {
		const images = await downloadImages(url)

		for (const image of images) {
			content.push({ type: 'image_url', image_url: { url: image } })
		}
	} catch (error) {
		log.warn({ err: error, booru, postId: post.id }, 'Booru image download failed')
		content.push({
			type: 'text',
			text: 'No se pudo descargar la imagen para verla. Los metadatos y la URL siguen disponibles.'
		})
	}

	return content
}

function booruError(error: unknown, toolName: string) {
	log.warn({ err: error, tool: toolName }, 'Booru tool failed')
	return { error: error instanceof Error ? error.message : String(error) }
}

export const booruAutocompleteTags = tool(
	async ({ tag, booru }) => {
		try {
			return await getBooruClient(booru).autocompleteTags(tag)
		} catch (error) {
			return booruError(error, 'booru_autocomplete_tags')
		}
	},
	{
		name: 'booru_autocomplete_tags',
		description:
			'Busca sugerencias de tags en el image board elegido. Usa el value para buscar imágenes. Para Rule34 usa sus herramientas propias.',
		schema: z.object({ tag: tagSchema, booru: booruSchema }).strict()
	}
)

export const booruRandomPost = tool(
	async ({ tag, booru }) => {
		try {
			const post = await getBooruClient(booru).getRandomPost(tag)

			if (!post) {
				return `No se encontraron posts en ${booru} para el tag ${tag}.`
			}

			return await postImages(booru, post)
		} catch (error) {
			return booruError(error, 'booru_random_post')
		}
	},
	{
		name: 'booru_random_post',
		description:
			'Trae una imagen aleatoria del image board elegido y entrega su contenido visual al modelo junto con los metadatos y la URL original. Las animaciones se muestran como fotogramas. Para Rule34 usa sus herramientas propias.',
		schema: z.object({ tag: tagSchema, booru: booruSchema }).strict()
	}
)

export const booruPosts = tool(
	async ({ tag, booru, page, limit }) => {
		try {
			const posts = await getBooruClient(booru).getPosts(tag, {
				page,
				limit
			})
			const content: ImageContent[] = [
				{
					type: 'text',
					text: JSON.stringify({
						booru,
						count: posts.count,
						offset: posts.offset
					})
				}
			]

			for (const post of posts.items) {
				content.push(...(await postImages(booru, post)))
			}

			return content
		} catch (error) {
			return booruError(error, 'booru_posts')
		}
	},
	{
		name: 'booru_posts',
		description:
			'Busca imágenes por tags en el image board elegido y entrega su contenido visual al modelo con metadatos y URLs originales. Las animaciones se muestran como fotogramas. Para Rule34 usa sus herramientas propias.',
		schema: z
			.object({
				tag: tagSchema,
				booru: booruSchema,
				page: z.number().int().min(0).default(0).describe('Página de resultados, empezando por cero'),
				limit: z.number().int().min(1).max(5).default(3).describe('Máximo de imágenes a traer')
			})
			.strict()
	}
)

export const rule34AutocompleteTags = tool(
	async (input) => {
		try {
			return await rule34Client.autocompleteTags(input.tag)
		} catch (error) {
			log.warn({ error, tool: 'rule34_autocomplete_tags', input }, 'Rule34 autocomplete tags failed')
			return {
				error: error instanceof Error ? error.message : String(error)
			}
		}
	},
	{
		name: 'rule34_autocomplete_tags',
		description: 'Busca sugerencias para un tag de Rule34. Usa el campo value de una sugerencia para buscar posts.',
		schema: z.object({
			tag: z.string().min(1).describe('Tag incompleto que se quiere autocompletar')
		})
	}
)

export const rule34RandomPost = tool(
	async (input) => {
		try {
			const post = await rule34Client.getRandomPost(input.tag)

			if (!post) {
				return `No se encontraron posts para el tag ${input.tag}.`
			}

			return post.file_url
		} catch (error) {
			log.warn({ error, tool: 'rule34_random_post', input }, 'Rule34 random post search failed')
			return {
				error: error instanceof Error ? error.message : String(error)
			}
		}
	},
	{
		name: 'rule34_random_post',
		description:
			'Devuelve la URL original y el contenido visual de un post aleatorio de Rule34 que tenga el tag indicado. Las imágenes se descargan y redimensionan para poder verlas; las animaciones se muestran como fotogramas.',
		schema: z.object({
			tag: z.string().min(1).describe('Tag de Rule34 usado para buscar el post')
		})
	}
)

export const rule34Posts = tool(
	async (input) => {
		try {
			return await rule34Client.getPosts(input.tag, {
				page: input.page,
				limit: input.limit
			})
		} catch (error) {
			log.warn({ error, tool: 'rule34_posts', input }, 'Rule34 post search failed')
			return {
				error: error instanceof Error ? error.message : String(error)
			}
		}
	},
	{
		name: 'rule34_posts',
		description: 'Devuelve un array de posts de Rule34 que tenga el tag indicado.',
		schema: z.object({
			tag: z.string().min(1).describe('Tag de Rule34 usado para buscar el post'),
			page: z.number().min(0).describe('Numero de la pagina del dataset de los posts'),
			limit: z.number().min(1).max(15).describe('Limite de la cantidad de posts que pueden haver en cada pagina')
		})
	}
)

export const booruTools = [
	rule34AutocompleteTags,
	rule34RandomPost,
	rule34Posts,
	booruAutocompleteTags,
	booruRandomPost,
	booruPosts
]
