# syntax=docker/dockerfile:1
ARG NODE_VERSION=24-alpine

# ---- build: compile the SvelteKit app -------------------------------------------------------
FROM node:${NODE_VERSION} AS build
WORKDIR /app

# python3/make/g++ are needed to build better-sqlite3's native addon on Alpine.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
# --ignore-scripts: the "prepare" script (svelte-kit sync + git hooks) needs the rest of the
# source and a .git dir, neither of which exist yet at this layer; `vite build` runs its own
# sync as part of the SvelteKit plugin, and there's no git repo to hook inside the image anyway.
RUN npm ci --ignore-scripts
# better-sqlite3's own install script (native compile) was skipped above; rebuild it explicitly.
RUN npm rebuild better-sqlite3

COPY . .

# SvelteKit's analyse step imports src/hooks.server.ts, which imports the db module and opens a
# connection — a real DATABASE_URL isn't needed at build time, just a writable path.
ENV DATABASE_URL=/tmp/build-time.db
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

RUN npm run build
RUN npm prune --omit=dev

# ---- prod-deps: a clean copy of only the runtime node_modules -------------------------------
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
RUN apk add --no-cache su-exec tzdata
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ---- runtime ----------------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
RUN apk add --no-cache su-exec tzdata
COPY --from=prod-deps /app /app
COPY --from=prod-deps /entrypoint.sh /entrypoint.sh

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION} \
	NODE_ENV=production \
	DATABASE_URL=/data/home-work-hours.db \
	PORT=3000 \
	TZ=Australia/Melbourne \
	PUID=99 \
	PGID=100

VOLUME ["/data"]
EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "build/index.js"]
