# Nymph

La misma pero ahora con inteligencia :D

![](./docs/nymph.webp)

El bot acepta únicamente tipos MIME compatibles con las entradas de la Responses API: JPEG, PNG, WebP, GIF, PDF, documentos, hojas de cálculo, presentaciones y los formatos de texto/código documentados por OpenAI. La lista explícita está en `src/agent/mime-types.ts`. Los tipos desconocidos o no admitidos (por ejemplo ZIP, SVG, audio y vídeo) se descartan silenciosamente antes de descargar el archivo, junto con su mensaje. Los GIF y las animaciones de Telegram (incluidas las convertidas a MP4) se convierten en hasta seis fotogramas PNG, tomando el primero y después como máximo uno por segundo. Las imágenes compatibles se envían como contenido visual y los documentos admitidos como archivos con su nombre y tipo MIME. Los MP4 identificados por Telegram como animaciones se aceptan solo para convertirlos a fotogramas PNG. Los adjuntos de más de 10 MB (10 × 1024 × 1024 bytes) se descartan silenciosamente junto con su mensaje, también en grupos. El límite se comprueba antes de descargar y durante la descarga. En privado responde directamente; en grupos conserva los adjuntos en el historial y responde cuando se activa una mención o un patrón de los habituales. Los modelos configurados en `NYMPH_AI_MODEL` y `NYMPH_SUMMARY_MODEL` deben admitir los adjuntos enviados.

## Compilar y ejecutar

Copia `.env.example` a `.env` y configura, como mínimo, `NYMPH_OPENAI_API_KEY` y `NYMPH_TELEGRAM_TOKEN`.

### Con npm

Instala `ffmpeg` y asegúrate de que esté disponible en `PATH` para procesar GIF y animaciones. La imagen Docker ya lo incluye.

```sh
cp .env.example .env
npm ci
npm run build
npm start
```

### Con Docker

```sh
cp .env.example .env
docker build -t nymph .
docker run --rm --env-file .env nymph
```
