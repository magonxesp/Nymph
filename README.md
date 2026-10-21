# Nymph

La misma pero ahora con inteligencia :D

![](./docs/nymph.webp)

## Compilar y ejecutar

Copia `.env.example` a `.env` y configura, como mínimo, `NYMPH_OPENAI_API_KEY` y `NYMPH_TELEGRAM_TOKEN`.

### Con npm

Instala `ffmpeg` y asegúrate de que esté disponible en `PATH` para redimensionar imágenes y procesar GIF y animaciones. La imagen Docker ya lo incluye.

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

### Con Docker Compose

Configura también `NYMPH_POSTGRES_PASSWORD` en `.env` y ejecuta:

```sh
docker compose up --build -d
```

Compose incluye PostgreSQL 17 Alpine con pgvector 0.8.7. Los datos se conservan en el volumen `postgres_data`; PostgreSQL está disponible en `postgres:5432` dentro de Compose y en `127.0.0.1:5432` desde el equipo local. `NYMPH_POSTGRES_DB` y `NYMPH_POSTGRES_USER` tienen el valor predeterminado `nymph`.

El fichero `sql/memories.sql` se ejecuta automáticamente al inicializar un volumen vacío. Define `chat_memories`, con memorias compartidas por `chat_id`, sin relación con usuarios. Los embeddings son opcionales y usarán un único modelo configurado en el programa. La dimensión y el índice vectorial se concretarán al elegir el modelo; las búsquedas deberán filtrar por chat.

Para iniciar únicamente la base de datos:

```sh
docker compose up --build -d postgres
```

Esta preparación todavía no conecta el bot con la base de datos.

`database.ts`, en la raíz, exporta la instancia `database` de Knex. Lee `NYMPH_POSTGRES_HOST` (por defecto `localhost`), `NYMPH_POSTGRES_PORT` (por defecto `5432`), `NYMPH_POSTGRES_DB`, `NYMPH_POSTGRES_USER` y `NYMPH_POSTGRES_PASSWORD`. En Compose, el bot usa `postgres:5432` para acceder al servicio.
