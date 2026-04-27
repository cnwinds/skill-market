# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/skill-spec/package.json packages/skill-spec/package.json

RUN npm ci

COPY apps/server/tsconfig.json apps/server/tsconfig.json
COPY apps/server/src apps/server/src
COPY packages/skill-spec/tsconfig.json packages/skill-spec/tsconfig.json
COPY packages/skill-spec/src packages/skill-spec/src

RUN npm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3100
ENV REGISTRY_ROOT=/app/registry

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/skill-spec/package.json packages/skill-spec/package.json

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/packages/skill-spec/dist packages/skill-spec/dist
COPY registry registry

EXPOSE 3100

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3100) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "--workspace", "@qizhi/skill-market-server", "run", "start"]
