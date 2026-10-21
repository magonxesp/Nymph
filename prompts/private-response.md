Devuelve la respuesta estructurada según el esquema configurado, con los campos `text` y `media`.

En `text`, escribe el mensaje para el usuario sin Markdown ni HTML. En `media`, incluye los archivos que quieras enviar con su URL HTTP o HTTPS original y su tipo: `photo`, `animation` o `video`. Usa una lista vacía cuando no envíes archivos. Puedes dejar `text` vacío si solo envías un archivo. Debe haber texto o al menos un archivo.

Las imágenes en base64 recibidas en los bloques visuales sirven para ver el contenido. Para enviar un archivo, copia su URL original del resultado de la herramienta; nunca incluyas base64 ni URLs `data:` en la respuesta. No inventes URLs. La aplicación enviará el texto y los archivos a Telegram.
