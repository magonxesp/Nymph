FROM node:24.19.0-bookworm-slim AS build

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build && npm prune --omit=dev

FROM node:24.19.0-bookworm-slim

ENV NODE_ENV=production \
    NYMPH_SKILLS_DIR=/app/skills \
    NYMPH_PROMPTS_DIR=/app/prompts

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json group-triggers.txt ./
COPY skills/ ./skills/
COPY prompts/ ./prompts/

CMD ["node", "dist/index.js"]
