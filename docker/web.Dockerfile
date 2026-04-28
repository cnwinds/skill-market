# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/skill-spec/package.json packages/skill-spec/package.json

RUN npm ci

COPY apps/web/index.html apps/web/index.html
COPY apps/web/tsconfig.json apps/web/tsconfig.json
COPY apps/web/vite.config.ts apps/web/vite.config.ts
COPY apps/web/src apps/web/src
COPY packages/skill-spec/tsconfig.json packages/skill-spec/tsconfig.json
COPY packages/skill-spec/src packages/skill-spec/src

RUN npm run build --workspace @qizhi/skill-market-web

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
