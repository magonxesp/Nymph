---
name: rule34
description: Busca un post sobre un tema concreto en Rule34 cuando el usuario lo pida explícitamente; identifica el tag con autocompletado y responde con la URL encontrada o con un mensaje sin resultados.
---

# Búsqueda en Rule34

Cuando el usuario pida buscar algo concreto en Rule34:

1. Forma un posible tag en minúsculas y `snake_case` a partir de lo que pidió. Conserva los calificadores necesarios para distinguir personajes, obras o variantes.
2. Consulta `rule34_autocomplete_tags` con ese tag o con una parte distintiva. Usa el campo `value` de las sugerencias para elegir un tag que corresponda claramente a la petición; no elijas una sugerencia solo por ser la primera. Si hace falta, prueba una variante razonable del nombre.
3. Cuando hayas identificado el tag, llama a `rule34_random_post` con él.
4. Si la tool devuelve una URL, responde únicamente con esa URL. Si no hay un tag claro, la tool no encuentra posts o la búsqueda falla, responde: «No he encontrado nada en Rule34.» No menciones el tag que intentaste usar.
