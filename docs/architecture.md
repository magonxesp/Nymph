# Arquitectura del código

El proyecto se organiza por funcionalidades y dominios. Los directorios deben explicar qué hace la aplicación: conversar, enviar mensajes, ejecutar tareas, recordar información o consultar fuentes externas.

La prioridad es que las responsabilidades y el recorrido de los datos sean fáciles de entender. Usamos tipos intermedios, interfaces y adaptadores para aislar dependencias concretas cuando aportan una separación útil. Aplicamos SOLID con criterio y KISS como guía para mantener las soluciones sencillas.

Este documento describe los módulos existentes y las reglas para evolucionarlos. No implica que todas las dependencias actuales estén ya aisladas. Las convenciones de formato y legibilidad están en [code-style.md](./code-style.md).

## Mapa de módulos

| Módulo o archivo  | Responsabilidad                                                                                                                     | Frontera que debe mantener                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/chat/`       | Identidad y tipo del chat, mensajes, adjuntos, historial, snapshots y preparación de respuestas de grupo.                           | Trabajar con conceptos propios de la conversación, sin objetos de Telegram ni detalles de su API.                                  |
| `src/messaging/`  | Contrato de envío, mensajes de salida, resultados normalizados y selección del sender por plataforma.                               | Ofrecer un contrato común para que los consumidores no tengan que conocer la implementación concreta.                              |
| `src/telegram/`   | Recibir actualizaciones, adaptar mensajes y adjuntos, detectar activadores propios de Telegram y enviar respuestas mediante grammY. | Encapsular los tipos del SDK, los IDs numéricos, las entidades, los enlaces `tg://` y las opciones de envío de Telegram.           |
| `src/agent/`      | Construir agentes, cargar contexto y skills, componer herramientas e integrar el modelo y sus callbacks.                            | Concentrar la configuración y la integración con el sistema de agentes; delegar las operaciones de cada funcionalidad a su módulo. |
| `src/task/`       | Modelar tareas, gestionar su estado y persistencia, delegar su ejecución y exponer herramientas relacionadas.                       | Expresar las tareas mediante tipos propios y usar el contrato común para entregar mensajes.                                        |
| `src/memory/`     | Modelar recuerdos y embeddings, transformar historial, generar recuerdos, persistirlos y buscarlos.                                 | Validar los datos externos en su entrada y mantener las reglas de los recuerdos en su dominio.                                     |
| `src/booru/`      | Consultar proveedores de imágenes mediante `BooruClient` y normalizar posts y tags.                                                 | Adaptar las diferencias de cada proveedor sin propagar sus respuestas HTTP o XML a los consumidores.                               |
| `src/browser/`    | Gestionar sesiones de navegación, herramientas MCP, URLs y resultados de investigación.                                             | Encapsular Playwright, el protocolo MCP y el ciclo de vida de los recursos de navegación.                                          |
| `src/ddgs/`       | Consultar el servicio de búsqueda y normalizar sus resultados.                                                                      | Aislar el formato y la comunicación con el servicio externo.                                                                       |
| `src/media/`      | Descargar y procesar imágenes y animaciones.                                                                                        | Encapsular la red y los procesos externos necesarios para transformar medios.                                                      |
| `src/time/`       | Exponer operaciones relacionadas con la fecha y la hora.                                                                            | Mantener esta funcionalidad pequeña y enfocada.                                                                                    |
| `src/index.ts`    | Cargar el entorno e iniciar la aplicación.                                                                                          | Ser un punto de entrada pequeño.                                                                                                   |
| `src/env.ts`      | Resolver variables de entorno y rutas de configuración.                                                                             | Evitar repartir la interpretación de configuración entre consumidores.                                                             |
| `src/database.ts` | Configurar la conexión compartida de base de datos.                                                                                 | Dejar las consultas y la conversión de filas a los repositorios de cada funcionalidad.                                             |
| `src/logging.ts`  | Configurar el logger compartido.                                                                                                    | Centralizar la configuración de registros.                                                                                         |

Fuera de `src/`:

- `prompts/` contiene instrucciones reutilizables para los modelos.
- `context/character/` contiene material de referencia del personaje.
- `skills/` contiene las skills disponibles para los agentes.
- `sql/squema.sql` mantiene el esquema completo de PostgreSQL. No se crean archivos de migración.
- `docs/` contiene documentación del proyecto.
- `dist/` contiene código generado y no se versiona.

## Responsabilidades y dirección de las dependencias

El módulo que posee una responsabilidad debe declarar su lógica y sus contratos. Otro módulo puede utilizarlos sin copiar esa lógica ni acceder a los detalles internos de su implementación.

Por ejemplo, `chat` define qué es un mensaje del historial. Telegram convierte sus mensajes a ese tipo; el historial no debe importar grammY ni llamar a un conversor de Telegram para poder guardar un mensaje.

En el envío hay dos responsabilidades distintas:

- `messaging/sender.ts` define lo que un consumidor necesita para enviar.
- `telegram/message-sender.ts` implementa ese contrato utilizando Telegram.

La factoría `messaging/factory.ts` conoce las implementaciones concretas para elegir una. Esa dependencia es intencionada: es un punto de composición. Debe mantenerse localizada ahí, sin extender la selección de plataformas por tareas, historial o agentes.

La recepción de un mensaje ocurre dentro de un adaptador que ya conoce su plataforma. Por eso puede construir su sender a partir del contexto nativo, siempre que los mensajes y resultados que intercambia respeten el mismo contrato común.

## Evitar el acoplamiento con tipos intermedios

Los datos que cruzan módulos deben expresar lo que necesita la aplicación, sin obligar al receptor a conocer el SDK o el formato de un proveedor.

El contrato actual de envío es un ejemplo:

```ts
export interface MessageSender {
	readonly chatId: ChatId
	send(message: OutgoingMessage): AsyncIterable<SentMessage>
}
```

`OutgoingMessage` contiene texto, medios, menciones y una referencia opcional al mensaje citado. `SentMessage` contiene un mensaje normalizado de `chat` y la información necesaria para distinguir texto de medios. Ninguno expone `Context`, `Api`, `MessageEntity` ni una respuesta nativa de Telegram.

El adaptador traduce entre esos conceptos y su plataforma:

1. Al recibir, convierte IDs, autores, menciones y adjuntos a tipos propios.
2. Al enviar, convierte el mensaje de salida a llamadas y opciones del SDK.
3. Tras el envío, convierte la respuesta del SDK a un mensaje que pueda guardar el historial.

Los IDs compartidos se representan como cadenas de texto. La conversión a IDs numéricos y sus restricciones pertenece al adaptador que los necesita.

Los tipos intermedios deben ser pequeños y concretos. No deben convertirse en una copia completa de cada SDK, en un objeto lleno de campos opcionales para plataformas hipotéticas ni en un contenedor `any` o `unknown` que traslade la interpretación al consumidor.

Tampoco hace falta duplicar un tipo propio si ya representa exactamente el contrato necesario. Reutilízalo cuando tenga el mismo significado y propietario; crea otro cuando las responsabilidades o necesidades sean distintas.

## Recorrido de una respuesta

El flujo actual de una conversación se reparte así:

1. `telegram/bot.ts` dirige una actualización al handler privado o de grupo.
2. El adaptador de Telegram normaliza los datos y actualiza el historial de `chat`.
3. El handler prepara el contexto e invoca el agente correspondiente de `agent`.
4. La respuesta del modelo se valida en su frontera de entrada y se prepara para su envío.
5. Un `MessageSender` entrega el mensaje mediante su implementación de plataforma.
6. El resultado normalizado se incorpora al historial.

Para enviar fuera de una actualización entrante, la plataforma se resuelve con el `ChatId`:

```ts
const sender = createMessageSender(chatId)

for await (const sent of sender.send({ text: "Hola", media: [] })) {
	await history.addAssistantMessage(sent.message)
}
```

El contexto de Telegram permite conservar temas y conexiones de negocio mediante `TelegramMessageSender.fromContext`. Estos detalles permanecen en el adaptador.

Actualmente los handlers también orquestan el historial y la invocación del agente. Si otro canal necesita ese mismo recorrido, se debe extraer la parte compartida a una función o servicio enfocado, evitando duplicar el flujo completo. No hace falta construir por adelantado un framework de conversaciones.

## Abstracciones simples: SOLID con KISS

Una abstracción debe resolver una necesidad concreta: aislar una integración, permitir implementaciones alternativas reales o separar responsabilidades que cambian por motivos distintos. Una interfaz puede estar justificada con una sola implementación cuando protege una frontera real, como el envío a una plataforma.

| Principio                 | Aplicación práctica                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsabilidad única     | Separar historial, ejecución de tareas y transporte. No exige una clase por cada operación.                                                           |
| Abierto/cerrado           | Añadir una implementación que respete el contrato común. Es razonable actualizar un `switch` pequeño en la factoría para seleccionarla.               |
| Sustitución de Liskov     | Las implementaciones deben respetar el significado del contrato, devolver resultados compatibles y comunicar los fallos sin fingir un envío correcto. |
| Segregación de interfaces | Exponer solo las operaciones necesarias para el consumidor. Evitar interfaces universales con métodos que algunas plataformas no puedan cumplir.      |
| Inversión de dependencias | Hacer que la lógica compartida use contratos propios. Localizar la construcción y selección de implementaciones en la composición.                    |

KISS limita la complejidad de estas decisiones:

- Prefiere una función a una clase si no necesitas estado ni ciclo de vida.
- Prefiere composición a jerarquías de herencia.
- Usa una factoría sencilla antes que un registro dinámico o un contenedor de inyección de dependencias.
- Inyecta las dependencias que necesites sustituir o controlar; evita añadir infraestructura de inyección sin un problema concreto.
- Añade capas cuando separen responsabilidades reales, no para que el árbol de directorios parezca una arquitectura predeterminada.
- Evita abstracciones genéricas, buses de eventos y sistemas de plugins para extensiones que todavía no se necesitan.
- Tolera pequeñas diferencias entre funcionalidades antes de forzarlas dentro de una abstracción llena de excepciones.
- Extrae comportamiento compartido cuando su significado sea estable, no solo porque dos fragmentos se parezcan.

El objetivo es reducir lo que un desarrollador necesita conocer para hacer un cambio. Si una abstracción exige seguir varios wrappers que solo reenvían parámetros, conviene simplificarla.

## Validación y persistencia

Los contratos internos se declaran con tipos e interfaces TypeScript. Zod se utiliza cuando hace falta validar datos externos en ejecución o declarar un esquema para el modelo o una herramienta. No se añaden esquemas para volver a comprobar contratos internos ya tipados.

Los datos recibidos de HTTP, modelos, procesos externos o la base de datos se tratan como `unknown` hasta validarlos. Después, los módulos deben trabajar con el tipo validado. Si un SDK ya garantiza una validación concreta, no se repite sin una razón adicional.

Las reglas de negocio permanecen en TypeScript y en el módulo que las posee. Los objetos de valor comprueban sus invariantes; los repositorios convierten las filas y encapsulan las consultas. Una interfaz de repositorio se introduce cuando aporta una separación útil, como las implementaciones persistente, en memoria y con caché de tareas.

El esquema SQL admite tipos, claves primarias, valores predeterminados e índices no únicos. La validación de aplicación no se desplaza a restricciones como `CHECK`, `NOT NULL` o `UNIQUE`. La comprobación de UUID duplicados de tareas debe serializarse en el repositorio para cubrir inserciones concurrentes.

## Dependencias que se deben evitar

- Importar tipos de Telegram en el historial, los modelos de tareas o los contratos comunes de envío.
- Hacer que un módulo de dominio invoque un adaptador concreto para construir sus propios datos.
- Repartir comprobaciones de plataforma y llamadas a su API entre los consumidores.
- Propagar filas SQL, entidades del SDK o respuestas HTTP por la aplicación sin normalizar.
- Introducir dependencias circulares entre módulos. Los imports de tipos también deben revisarse para mantener una estructura comprensible.
- Crear clientes, conexiones o agentes al importar un módulo cuando eso obligue a consumidores ajenos a disponer de credenciales o inicializar recursos. La inicialización debe hacerse de forma explícita o diferida donde corresponda.
- Crear interfaces sin una responsabilidad clara, clases base genéricas o capas que únicamente reenvíen llamadas.
- Convertir módulos como `utils`, `common` o `services` en cajones de funciones sin propietario.

La separación actual es parcial: hay contratos propios de conversación y envío, pero la construcción de agentes y algunos modelos de conversación todavía conocen LangChain. Las dependencias existentes se deben revisar al modificar esas zonas; este documento no presupone una independencia total que aún no existe.

## Cómo evolucionar un módulo

Antes de añadir una dependencia o una abstracción, identifica qué módulo posee la responsabilidad, qué datos necesita su consumidor y qué detalle concreto debe quedar encapsulado. Implementa el contrato más pequeño que cubra esa necesidad.

Para incorporar otra plataforma de mensajería, añade su adaptador de entrada y su implementación de `MessageSender`, registra su selección en la factoría y prueba sus conversiones. El historial y los consumidores del contrato no deberían necesitar conocer sus tipos nativos.

Prueba las reglas de dominio con datos propios y las conversiones de cada adaptador con fixtures del proveedor. Las pruebas de contrato deben comprobar comportamientos relevantes, como el destino del envío, las citas, las menciones, los resultados normalizados y la propagación de errores.
