import { z } from "zod"

export type ResponseMedia = {
    url: string
    type: "photo" | "animation" | "video"
}

export type PrivateResponse = {
    text: string
    media: ResponseMedia[]
}

export const responseMediaSchema = z.object({
    url: z.string().regex(/^https?:\/\/\S+$/).refine(url => URL.canParse(url), "Invalid media URL")
        .describe("URL HTTP o HTTPS original del archivo devuelto por la herramienta; nunca una URL data: ni base64"),
    type: z.enum(["photo", "animation", "video"]).describe("photo para imágenes estáticas, animation para GIF o MP4 sin sonido, video para vídeos")
}).strict() satisfies z.ZodType<ResponseMedia>

export const responseMediaListSchema = z.array(responseMediaSchema)
    .describe("Archivos que se enviarán a Telegram usando sus URLs originales. Lista vacía si no hay archivos")

export const privateResponseSchema = z.object({
    text: z.string().describe("Texto para el usuario, sin Markdown ni HTML; puede estar vacío si se envían archivos"),
    media: responseMediaListSchema
}).strict() satisfies z.ZodType<PrivateResponse>
