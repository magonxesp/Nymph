# Nymph

La misma pero ahora con inteligencia :D

![](./docs/nymph.webp)

## Compilar y ejecutar

Copia `.env.example` a `.env` y configura `NYMPH_OPENAI_API_KEY`, `NYMPH_TELEGRAM_TOKEN` y las variables `NYMPH_POSTGRES_*` para conectar con tu base de datos.

### Con npm

Necesitas Node.js 24, `ffmpeg` disponible en `PATH` y una base de datos PostgreSQL 17 con pgvector instalado. Crea la base de datos y el usuario y configura la conexión en `.env` antes de arrancar.

```sh
cp .env.example .env
npm ci
```

Crea las tablas ejecutando el SQL con los datos de tu conexión (el siguiente ejemplo usa los valores predeterminados de `.env.example` y solicita la contraseña):

```sh
psql -h localhost -p 5432 -U nymph -d nymph -v ON_ERROR_STOP=1 -f sql/memories.sql
npm run build
npm start
```

### Con Docker

Necesitas una base de datos PostgreSQL 17 con pgvector instalado, accesible desde el contenedor. Crea la base de datos, el usuario y las tablas ejecutando `sql/memories.sql` con `psql`, como en la sección anterior. Configura las variables `NYMPH_POSTGRES_*` en `.env`; `NYMPH_POSTGRES_HOST` debe apuntar al servidor de PostgreSQL desde el contenedor. Si PostgreSQL se ejecuta en el equipo local y usas Docker Desktop, puedes utilizar `host.docker.internal`.

La imagen Docker incluye Node.js y `ffmpeg`.

```sh
cp .env.example .env
docker build -t nymph .
docker run --rm --env-file .env nymph
```

### Con Docker Compose

Configura `NYMPH_POSTGRES_PASSWORD` en `.env`. Arranca PostgreSQL y espera a que esté disponible:

```sh
docker compose up --build -d --wait postgres
```

Compose incluye PostgreSQL 17 Alpine con pgvector 0.8.7. Los datos se conservan en el volumen `postgres`; PostgreSQL está disponible en `postgres:5432` dentro de Compose y en `127.0.0.1:5432` desde el equipo local. `NYMPH_POSTGRES_DB` y `NYMPH_POSTGRES_USER` tienen el valor predeterminado `nymph`.

Crea las tablas una sola vez por base de datos nueva. El SQL habilita la extensión pgvector y crea las tablas e índices; no se ejecuta automáticamente:

```sh
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' < sql/memories.sql
```

Después, compila y arranca el bot:

```sh
docker compose up --build -d nymph
```
