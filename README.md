# SkillMarket

SkillMarket is the Skill marketplace, versioning, review, publishing, and distribution service. It does not execute Skill scripts, manage SkillChat sessions, or read SkillChat user files.

## Structure

```text
apps/server              Market API service
apps/web                 Web frontend
packages/skill-spec      Shared frontend/backend schemas and types
registry/skills          Built-in public Skill seed data
docker                   Docker build, compose, and runtime data
docs                     API and handoff documents
scripts                  Import and maintenance scripts
```

## Local Development

```powershell
npm install
npm run build
npm run typecheck
npm test
```

Backend default:

```text
http://127.0.0.1:3100
```

Health and public list:

```powershell
curl http://127.0.0.1:3100/health
curl http://127.0.0.1:3100/api/v1/skills
```

## Docker

Docker files and Docker runtime data live under `docker/`:

```text
docker/
  Dockerfile              Backend API image
  web.Dockerfile          Frontend Nginx/static image
  Dockerfile.dockerignore
  compose.yml
  nginx.conf
  entrypoint.sh
  data/
    registry/
```

Start:

```powershell
npm run docker:up
```

Logs:

```powershell
npm run docker:logs
```

Stop:

```powershell
npm run docker:down
```

Compose starts two containers:

```text
skill-market-server  Backend API, http://localhost:3100
skill-market-web     Frontend site, http://localhost:7080
```

The web container proxies `/api/*` and `/health` to `skill-market-server:3100`.

Docker runtime data lands in:

```text
docker/data/registry
```

Compose mounts `docker/data/registry` into the container as the writable `/app/registry` runtime registry, and mounts the repository `registry` directory read-only as `/app/registry-seed`. On startup, the backend entrypoint copies `/app/registry-seed/skills` into `docker/data/registry/skills` when the mounted `skills` directory is missing or empty. Users, sessions, uploads, reviews, published packages, featured markers, and removed markers are persisted under `docker/data/registry`.

Equivalent Compose command:

```powershell
docker compose -f docker/compose.yml up -d --build
```

## API

The frontend/backend contract is maintained in:

```text
docs/market-api.md
```

Shared payload schemas and types live in `packages/skill-spec`. Any route, query parameter, enum, request body, or response shape consumed by the frontend must be documented in `docs/market-api.md`.

## Import Official Skills

Import official packages from `official-skills/dist` into the built-in registry:

```powershell
npm run import:official -- ..\official-skills\dist
```

If Docker runtime data has already been initialized, importing into the repository registry does not overwrite `docker/data/registry`. To reset Docker runtime data, stop the service and clear `docker/data/registry`.
