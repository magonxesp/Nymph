---
name: booru
description: Busca imágenes y wallpapers de personajes de anime con las tools de booru, y consulta referencias visuales cuando pregunten por su aspecto. Prioriza imágenes no explícitas, distingue los boards con contenido para adultos y revisa los resultados antes de enviarlos.
---

# Imágenes y referencias de personajes de anime

Usa las tools de booru cuando alguien pida una imagen, foto, ilustración o wallpaper de un personaje de anime, o pregunte cómo es su aspecto, ropa, pelo, ojos u otros rasgos visuales. No sustituyas la búsqueda por una descripción inventada. Para preguntas solo sobre historia, personalidad o relaciones, consulta las fuentes de contexto pertinentes; esta skill se ocupa de referencias visuales.

## Elegir board y clasificación

El input `booru` usa estos nombres exactos:

| `booru` | Sitio | Contenido y filtro inicial |
| --- | --- | --- |
| `safebooru` | safebooru.org | Orientado a contenido no explícito. Usa `rating:safe` y revisa cada resultado. |
| `konachan.net` | konachan.net | Variante SFW de Konachan; preferida para wallpapers. Usa `rating:safe`. |
| `gelbooru` | gelbooru.com | Incluye contenido +18. Usa `rating:general`. |
| `danbooru` | danbooru.donmai.us | Incluye contenido +18. Usa `rating:general`. |
| `sonohara` | sonohara.donmai.us | Trátalo como un board que puede contener +18. Usa `rating:general`. |
| `konachan` | konachan.com | Versión sin la restricción SFW; incluye +18. Usa `rating:safe`. |
| `yandere` | yande.re | Incluye contenido +18. Usa `rating:safe`. |

Si el usuario especifica un board, respeta esa elección. Si no especifica ninguno, empieza por `safebooru` para imágenes y referencias generales, o por `konachan.net` para wallpapers. Los boards +18 también cuentan con material no explícito: puedes buscar imágenes generales en ellos usando sus filtros correspondientes, sin descartarlos por el contenido adulto que también alojan. El nombre del sitio no determina el contenido de un post. Tampoco asumas que todo resultado de un board SFW es apropiado: puede haber errores de clasificación o diferencias en la API.

En Gelbooru moderno y Danbooru, `g` significa general, `s` significa sensible, `q` cuestionable y `e` explícito. En Moebooru, `s` significa safe. No interpretes `s` igual en todas las APIs. Safebooru documenta general y safe, además de questionable y explicit: contrasta su clasificación con el contenido visual. No trates `q`, `e` ni una clasificación desconocida como apta para enviar por defecto.

## Buscar y revisar

1. Identifica el personaje y su obra. Si el nombre es ambiguo y el contexto no lo resuelve, acláralo antes de buscar. Usa tags en minúsculas con guiones bajos y conserva los calificadores de personaje u obra.
2. Llama a `booru_autocomplete_tags` con `tag` y `booru`. Elige un `value` que corresponda al personaje, no simplemente la primera sugerencia. Los nombres pueden variar entre boards: vuelve a verificar el tag al cambiar de sitio. Si el autocompletado falla, prueba una variante razonable directamente, sin reintentarlo en bucle.
3. Busca con `booru_posts`, pasando el tag del personaje y el filtro de clasificación juntos en `tag`. Empieza con `page: 0` y `limit: 3`; la página empieza en cero y el máximo de imágenes por llamada es cinco. Por ejemplo: `{"booru":"konachan.net","tag":"spike_spiegel rating:safe","page":0,"limit":3}`. Para una elección aleatoria puedes usar `booru_random_post` con los mismos filtros.
4. Para wallpapers, compara `width` y `height` con la orientación o resolución solicitada. Si no se indicó una preferencia, elige una imagen de buena resolución y composición apropiada. Puedes añadir `highres` o `wallpaper`, pero relaja esos tags antes de concluir que no hay imágenes del personaje; mantén siempre el filtro no explícito.
5. Examina los bloques visuales que devuelve la tool junto con `rating`, `tags` y los demás metadatos. Comprueba identidad, vestuario y contenido. No basta con el rating. Los bloques visuales sirven para que tú inspecciones la imagen; no autorizan enviarla automáticamente al usuario. Si la descarga falla y solo recibes metadatos, no afirmes haber visto la imagen ni describas detalles visuales no verificados.
6. Limita la búsqueda a **tres intentos en total por petición**, sumados entre todos los boards. Cada llamada a `booru_posts` o `booru_random_post` cuenta como un intento, también si falla; cambiar de página, tag o board no reinicia el contador. Haz como máximo un autocompletado por board y no lo reintentes si falla. Detente en cuanto encuentres una imagen adecuada o agotes los tres intentos.
7. Si un board falla y el usuario no ha especificado ninguno, prueba con otro disponible, manteniendo el filtro no explícito y el límite total de tres intentos. No insistas en el servicio que está fallando. Si el usuario eligió un board, no cambies de sitio por iniciativa propia: explica el fallo. Si no hay resultados adecuados, puedes variar el tag o consultar otro board cuando la elección sea libre, siempre dentro del mismo límite. Al agotarlo, resume lo encontrado o indica que no has podido completar la búsqueda; no sigas buscando ni afirmes haber agotado todos los resultados. Un error de red, autenticación o servicio no significa que no existan imágenes.

Las tools `booru_*` excluyen Rule34. No uses Rule34 como alternativa automática para peticiones normales de personajes o wallpapers. Si el usuario pide expresamente ese sitio, usa sus tools `rule34_*` y la skill `rule34`; la comprobación de contenido y los límites de esta skill siguen aplicándose. `rule34_random_post` devuelve una URL, no una imagen inspeccionada: no afirmes que la has visto ni que sea no explícita.

## Resultados para adultos y consentimiento

Prioriza siempre una imagen no explícita que satisfaga la petición. Si la encuentras, muéstrala o úsala como referencia y no preguntes si quiere ver otras explícitas. Una petición genérica de una imagen, un wallpaper o una descripción del aspecto no es consentimiento para contenido para adultos.

Solo si no has encontrado imágenes no explícitas adecuadas tras las búsquedas realizadas y sí han aparecido resultados para adultos, indícalo brevemente y pregunta antes de mostrar cualquier resultado para adultos permitido. No adjuntes imágenes, miniaturas, enlaces ni previews de esos resultados en la pregunta; deja `media` vacío y espera la respuesta. No afirmes que solo existen imágenes explícitas si únicamente has comprobado algunas búsquedas, ni que las has encontrado si las tools no las devolvieron.

El consentimiento no permite mostrar pornografía, contenido sexual gráfico ni contenido sexual de personajes menores o de apariencia infantil. No busques ni ofrezcas mostrar ese material; si los únicos resultados encontrados son de ese tipo, ofrece cambiar la búsqueda para encontrar una alternativa no explícita. Un rating del sitio no sustituye esta comprobación.

## Responder o enviar

Si preguntan por el aspecto, describe únicamente los rasgos observados en las referencias no explícitas y distingue variantes de vestuario, transformaciones o fanart del diseño habitual. No presentes una ilustración de un artista como prueba de un detalle canónico. No envíes una imagen por defecto si solo han pedido una descripción.

Si piden una imagen o wallpaper, usa la URL HTTP o HTTPS original de `post.file_url` del resultado elegido en `media`, con `type: photo` para una imagen estática, `animation` para GIF o MP4 sin sonido y `video` para vídeo. Si la tool usó una muestra o preview por falta del original, no la presentes como el archivo original ni como un wallpaper de resolución mayor a la disponible. Nunca envíes una URL `data:` ni el base64 devuelto para inspección.

En privado, incluye el archivo en `media` de la respuesta estructurada. En grupos, ponlo en `media` del mensaje correspondiente de `messages`. Completa los demás campos exigidos por el esquema del chat. Un enlace solo en `text` no sustituye el envío por `media`. Si no hay resultados adecuados o estás esperando consentimiento, deja `media` vacío.

Referencias de clasificación: [Gelbooru](https://gelbooru.com/index.php?page=wiki&s=view&id=2535), [Danbooru](https://safebooru.donmai.us/wiki_pages/howto:rate), [Safebooru](https://safebooru.org/index.php?page=help&topic=rating) y [Konachan](https://konachan.net/help/ratings).
