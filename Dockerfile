FROM node:24.19.0-bookworm-slim AS build

WORKDIR /app

RUN npm install --global pnpm@12.15.0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build && pnpm prune --prod

FROM node:24.19.0-bookworm-slim

ENV NODE_ENV=production \
    NYMPH_SKILLS_DIR=/app/skills \
    NYMPH_PROMPTS_DIR=/app/prompts

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json group-triggers.txt ./
COPY skills/ ./skills/
COPY prompts/ ./prompts/

CMD ["node", "dist/index.js"]
