# syntax=docker/dockerfile:1
# One image, two services: the API and the BullMQ workers (see
# docker-compose.yml). Archetype D per ADR-019 and BenboStandard 01.
#
# glibc (bookworm), not alpine: bcrypt ships prebuilt glibc binaries.
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@postly/api..." --filter "@postly/workers..."
RUN pnpm turbo build --filter=@postly/api --filter=@postly/workers
# Runtime dependencies only. The @postly/* packages are bundled into dist.
RUN pnpm --filter @postly/api deploy --prod --legacy /out/api \
 && pnpm --filter @postly/workers deploy --prod --legacy /out/workers

FROM node:22-bookworm-slim AS runtime
# The upstream image lags Debian security updates (pcre2, 2026-09); pick
# them up at build time rather than waiting for a new base tag.
RUN apt-get update && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*
# npm and corepack are not used at runtime, and their vendored dependencies
# are what an image scan reports first.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
ENV NODE_ENV=production \
    MIGRATIONS_DIR=/app/drizzle
WORKDIR /app
COPY --from=build /out/api/node_modules ./api/node_modules
COPY --from=build /repo/apps/api/dist ./api/dist
COPY --from=build /repo/apps/api/package.json ./api/package.json
COPY --from=build /out/workers/node_modules ./workers/node_modules
COPY --from=build /repo/apps/workers/dist ./workers/dist
COPY --from=build /repo/apps/workers/package.json ./workers/package.json
COPY --from=build /repo/packages/db/drizzle ./drizzle
USER node
EXPOSE 3000
CMD ["node", "api/dist/index.js"]
