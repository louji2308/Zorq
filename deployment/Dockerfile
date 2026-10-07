# Zorq production image — Phase 2 deploy contract (ARCHITECTURE.md §1: deployment/ owns Dockerfile + Render config).
#
# NOT built locally: D-0.6 records that Docker is absent in this dev environment, so this recipe is
# review-only until Render builds it (Phase 9). It is proven equivalent to the verified local build by:
#   (a) running the exact local commands (`npm ci`, `npm run build`) in the build stage;
#   (b) asserting every COPY source exists in the repo (checked in Phase 2 handoff, W-2.3);
#   (c) runtime layout matches the verified `npm start` path: dist/server/main.js + dist/web.
#
# Build context = repository root (Render: dockerfilePath ./deployment/Dockerfile).
# Ignore rules live at the context root in .dockerignore (Docker resolves .dockerignore only from
# the context root or as `<Dockerfile>.dockerignore`, never from deployment/) — see that file.
# No secrets: .env is never copied; .env.example (placeholders only) ships for the env contract.

ARG NODE_IMAGE=node:22-slim

# --- Stage 1: install WITH devDependencies, build dist/, then prune to prod deps ---------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# Files `npm run build` (= `tsc -p tsconfig.build.json && vite build`) reads, verbatim:
# tsconfig.build.json extends tsconfig.json; vite.config.ts roots the web build at src/web.
COPY tsconfig.json tsconfig.build.json vite.config.ts ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# --- Stage 2: minimal runtime ------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
# package.json is required at runtime: `"type": "module"` makes dist/**/*.js load as ESM.
COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY .env.example ./.env.example
# Non-root: the official node image ships the `node` user (uid 1000); app only reads.
USER node
EXPOSE 3000
# Listen port is derived from APP_BASE_URL (src/server/config.ts resolvePort → 3000).
# Phase 9 must reconcile this with any platform-injected PORT before going live.
CMD ["node", "dist/server/main.js"]
