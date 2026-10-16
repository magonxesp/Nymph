# Nymph

La misma pero ahora con inteligencia :D

![](./docs/nymph.webp)

## Compilar y ejecutar

Copia `.env.example` a `.env` y configura, como mínimo, `NYMPH_OPENAI_API_KEY` y `NYMPH_TELEGRAM_TOKEN`.

### Con npm

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
