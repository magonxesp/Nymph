---
name: rule34
description: Busca un post sobre un tema concreto en Rule34 cuando el usuario lo pida explícitamente; identifica el tag con autocompletado y devuelve la URL del archivo en media dentro de la respuesta estructurada, o un mensaje sin resultados.
---

# Búsqueda en Rule34

En el chat, carga la skill `task` y encola las búsquedas que requieran Rule34. Cuando ejecutes la tarea, sigue estas instrucciones directamente.

Cuando el usuario pida buscar algo concreto en Rule34:

Si el usuario permite elección propia (por ejemplo, «elige tú», «lo que quieras» o «sorpréndeme»), usa `rule34_posts` siguiendo el flujo de búsqueda libre descrito más abajo. Esta indicación tiene prioridad sobre el uso de `rule34_random_post` de los pasos siguientes. Respeta los temas y las preferencias que haya indicado el usuario.

1. Forma un posible tag en minúsculas y `snake_case` a partir de lo que pidió. Conserva los calificadores necesarios para distinguir personajes, obras o variantes.
2. Consulta `rule34_autocomplete_tags` con ese tag o con una parte distintiva. Usa el campo `value` de las sugerencias para elegir un tag que corresponda claramente a la petición; no elijas una sugerencia solo por ser la primera. Si hace falta, prueba una variante razonable del nombre. Si el autocompletado falla o no está disponible, prueba directamente `rule34_random_post` con el posible tag formado en el paso 1, sin reintentar el autocompletado.
3. Cuando hayas identificado el tag, o como alternativa si falla el autocompletado, llama a `rule34_random_post` con él. Usa la URL original del bloque de texto. No abras la URL, no descargues el archivo ni uses herramientas adicionales para mirar, inspeccionar o analizar su contenido. Si la herramienta incluye bloques visuales o fotogramas, ignóralos: no es necesario examinar el contenido para enviar el enlace.
4. Si una herramienta devuelve un campo `error`, su valor indica el fallo ocurrido. Si falla `rule34_autocomplete_tags`, aplica la alternativa del paso 2. Si falla `rule34_random_post`, detén la búsqueda y responde que ha habido un error sin decir mucho detalle del error, no lo confundas con una búsqueda sin resultados ni reintentes la operación.
5. Si la tool devuelve una URL, copia la URL HTTP o HTTPS original del bloque de texto al campo `media` de la respuesta estructurada, tanto en privado como en el elemento correspondiente de `messages` en grupos. Cada archivo tiene `url` y `type`: usa `photo` para imágenes estáticas, `animation` para GIF y MP4 sin sonido, o `video` para vídeos. Determina el tipo con los metadatos devueltos o la extensión de la URL, sin consultar su contenido. Nunca uses el base64 ni una URL `data:` como URL de envío. Deja `text` vacío al enviar el archivo; no añadas descripciones ni comentarios sobre su contenido visual. Si no hay un tag claro o la tool no encuentra posts, responde que no has encontrado nada y deja `media` vacío. No menciones el tag que intentaste usar. Si lo ves conveniente suguiere que podria obtener resultados.

Para una búsqueda libre de un post, o cuando el usuario permita elección propia, usa la herramienta `rule34_posts` para consultar los posts de un tag, como máximo hasta 3 páginas. Elige el tag respetando las preferencias del usuario y selecciona un post a partir de los metadatos devueltos. Usa directamente la URL de `file_url` del objeto del post en el campo `media` de la respuesta estructurada, con el tipo correspondiente. No llames a `rule34_fetch_post_files` ni abras o descargues la URL para inspeccionar el contenido.

## Formato de envío

En todos los flujos, devuelve el enlace original del archivo como un elemento de `media` con los campos `url` y `type`. Para una imagen estática, la respuesta en privado tiene esta forma (sustituye la URL de ejemplo por la URL real devuelta por la herramienta):

```json
{"text":"","media":[{"url":"https://example.com/image.jpg","type":"photo"}]}
```

En grupos, coloca ese mismo elemento en `media` del mensaje correspondiente dentro de `messages` y completa los demás campos del esquema del grupo. El enlace debe estar en `media`, no únicamente en `text` ni como enlace Markdown. Esta regla también se aplica al usar `file_url`.
