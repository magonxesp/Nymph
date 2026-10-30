# Convenciones de código

El código debe poder leerse de arriba abajo, con nombres que expliquen la intención y bloques que separen responsabilidades. Estas convenciones se aplican al código nuevo y a las partes que se modifiquen.

## Formato con Prettier

[`.prettierrc`](../.prettierrc) y [`.editorconfig`](../.editorconfig) son la fuente de verdad del formato. La configuración actual utiliza:

- Tabuladores para la indentación, con un tamaño de 4 espacios.
- Comillas dobles en TypeScript (`singleQuote: false`).
- Sin punto y coma ni comas finales.
- Espacios dentro de las llaves de objetos e imports.
- Un ancho de impresión de 120 caracteres, definido en `.prettierrc`. Este valor prevalece sobre el de `.editorconfig` y es una referencia para Prettier, no un límite estricto para cualquier línea.
- UTF-8, finales de línea LF y salto de línea al final del archivo.

```ts
import { ChatId } from "../chat/id.js"
import { ChatPlatform } from "../chat/platform.js"

const chatId = new ChatId("123", ChatPlatform.Telegram)
const message = { text: "Hola", media: [] }
```

Prettier mantiene el formato mecánico. La separación de responsabilidades, los nombres y los bloques lógicos se revisan también al escribir el código: ejecutar el formateador no garantiza por sí solo que sea legible.

## Separar los bloques lógicos

Agrupa las instrucciones que realizan una misma operación. Usa una línea en blanco al cambiar de propósito: obtener datos, comprobar una condición, transformar datos, persistir o devolver un resultado.

```ts
async function completeTask(task: Task, result: PrivateResponse): Promise<void> {
	const completedTask = task.success(result)
	const savedTask = await repository.update(completedTask)

	if (savedTask === undefined) {
		throw new Error("Task not found")
	}

	const sender = createMessageSender(savedTask.chatId)

	for await (const sent of sender.send(result)) {
		await history.addAssistantMessage(sent.message)
	}
}
```

No añadas una línea en blanco entre cada instrucción. Las declaraciones y operaciones que pertenecen al mismo paso deben permanecer juntas. Si necesitas explicar muchos pasos dentro de una función, extrae las responsabilidades que tengan sentido por sí mismas a funciones con nombres descriptivos.

## Condicionales con llaves y cuerpo multilínea

Todos los `if` y `else` deben usar llaves, aunque solo contengan un `return`, un `throw` o una llamada. El cuerpo debe ocupar sus propias líneas.

```ts
if (task === undefined) {
	return { error: "Task not found" }
}

if (task.status === "completed") {
	await sendResult(task)
} else {
	log.debug({ taskId: task.taskId.value }, "Task is still pending")
}
```

Evita formas como `if (task === undefined) return` o `if (task === undefined) { return }`. Separa la comprobación de la operación que viene después con una línea en blanco.

Cuando una condición sea larga, expresa sus partes mediante booleanos con nombres claros:

```ts
const hasCanonicalReplyId = replyToMessageId === undefined || /^[1-9]\d*$/.test(replyToMessageId)
const hasSafeReplyId = telegramReplyId === undefined || Number.isSafeInteger(telegramReplyId)

if (!hasCanonicalReplyId || !hasSafeReplyId) {
	throw new Error("Invalid Telegram reply message ID")
}
```

## Funciones y arrow functions

Usa declaraciones `function` para funciones del módulo con una responsabilidad propia. Usa arrow functions para callbacks y operaciones locales cuando faciliten la lectura.

Separa las declaraciones de funciones y de arrow functions con una línea en blanco. No las escribas pegadas unas a otras:

```ts
const isCompleted = (task: Task): boolean => task.status === "completed"

const getTaskPrompt = (task: Task): string => task.prompt

const completedPrompts = tasks.filter(isCompleted).map(getTaskPrompt)
```

Un callback corto puede usar un retorno implícito. Si contiene varias operaciones, usa un cuerpo con llaves y separa sus bloques lógicos:

```ts
const summaries = tasks.map((task) => {
	const prompt = task.prompt.trim()
	const status = task.status

	return { prompt, status }
})
```

Evita encadenar callbacks largos o anidar varias arrow functions en una sola expresión. Extrae los pasos a funciones con nombre o a variables intermedias. Las cadenas breves de `filter` y `map` pueden permanecer juntas cuando se entiendan de una lectura.

## Nombres y organización

- Usa nombres descriptivos en `camelCase` para variables y funciones, y `PascalCase` para clases, tipos e interfaces.
- Usa nombres de archivo en minúsculas; separa palabras con guiones cuando sea necesario, como `group-response.ts`.
- Organiza los módulos por dominio o funcionalidad. Declara cada función en el módulo que posee su responsabilidad.
- Cuando un módulo crezca, agrupa sus partes relacionadas en un directorio con submódulos enfocados.
- Usa módulos ES e imports relativos con extensión `.js`, como exige la configuración NodeNext.
- Usa `import type` para dependencias que solo se utilizan como tipos.
- Mantén los detalles de cada plataforma en su adaptador. Los contratos compartidos deben usar tipos propios de la aplicación.

## TypeScript y Zod

Mantén la comprobación estricta y declara los tipos e interfaces de la aplicación de forma independiente. Si TypeScript basta para expresar un contrato interno, no añadas un esquema Zod para volver a comprobarlo.

```ts
export type MessageMention = {
	userId: string
	text: string
}

export type OutgoingMessage = {
	text: string
	media: ResponseMedia[]
	mentions?: MessageMention[]
	replyToMessageId?: string
}
```

Usa Zod cuando sea necesaria una validación en tiempo de ejecución de datos externos o un esquema para una API o herramienta. Por ejemplo: JSON recibido por HTTP, filas de base de datos y respuestas o argumentos generados por un modelo. Trata los datos externos como `unknown` hasta validarlos en su frontera de entrada.

```ts
export type SearchResult = {
	title: string
	url: string
}

const searchResultSchema = z.object({
	title: z.string(),
	url: z.string().url()
}) satisfies z.ZodType<SearchResult>

const data: unknown = await response.json()
const result = searchResultSchema.parse(data)
```

No derives los tipos de la aplicación con `z.infer`, `z.input` o `z.output`. No repitas la validación de un dato que ya se haya validado, salvo que exista una transformación o una frontera nueva que lo justifique. Tampoco uses una aserción de tipo para hacer pasar datos externos sin validar.

TypeScript no garantiza reglas de negocio como que un texto no esté vacío o que un número sea positivo. Conserva esas comprobaciones cuando sean necesarias; usa condiciones sencillas para las reglas internas que no requieran un esquema.

Los objetos de valor deben tener un constructor público tipado que llame a un método privado `validate`. Expón su `value` como `public readonly` y comprueba su validez sin repetir comprobaciones de tipos que ya garantiza TypeScript. La clase propietaria debe exponer el objeto de valor como propiedad `public readonly`, sin getters que solo reenvíen su valor.

## Pruebas legibles

Importa normalmente el código bajo prueba, construye los datos con fixtures sencillos y comprueba el resultado o el error. Separa preparación, ejecución y comprobaciones mediante líneas en blanco cuando esos pasos lo necesiten.

```ts
it("selects the sender for the chat platform", () => {
	const chatId = new ChatId("123", ChatPlatform.Telegram)

	const sender = createMessageSender(chatId)

	expect(sender).toBeInstanceOf(TelegramMessageSender)
	expect(sender.chatId).toBe(chatId)
})
```

Evita cargas dinámicas de código fuente, wrappers creados solo para las pruebas y aserciones de tipo para introducir datos malformados.

## Comprobaciones antes de entregar

Usa la versión de pnpm declarada en `package.json`.

```sh
pnpm format
pnpm lint
pnpm run build
pnpm test --run
```

`pnpm format` formatea `src/`; no incluye este documento. Para formatear o comprobar esta guía:

```sh
pnpm exec prettier docs/CODE_STYLE.md --write
pnpm exec prettier docs/CODE_STYLE.md --check
```

Usa `pnpm lint:fix` cuando proceda y revisa los cambios automáticos. Oxlint y Prettier se complementan con la revisión de las convenciones de legibilidad descritas aquí.
