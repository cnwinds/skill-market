# SkillMarket Handoff

## Current Delivery

- `@qizhi/skill-spec` is the shared contract package. It exports manifest, market summary/detail/version, auth user, submission, package validation, and response schemas.
- `apps/server` is a Fastify + TypeScript Market API service.
- The server manages public Skill distribution, package upload, validation, review, and registry publishing.
- The server does not execute Skill scripts and does not read SkillChat session data.

## Registry Layout

Public versions live under:

```text
registry/
  skills/
    {publisher}/
      {name}/
        {version}/
          manifest.json
          package.tgz or package.zip
```

`manifest.json` must pass `skillManifestSchema`. Directory `{publisher}/{name}/{version}` must match `manifest.id` and `manifest.version`.

Removed versions contain:

```text
removed.json
```

Public registry scanning and package download skip removed versions.

## Market Data Layout

Runtime market data lives under:

```text
registry/
  market-data/
    market.json
    uploads/
```

`market.json` stores users, bearer sessions, submissions, audit logs, and featured Skill ids. `uploads/` stores draft package uploads.

When running through Docker Compose, the host-side registry path is:

```text
docker/data/registry/
```

Compose mounts it into the container as `/app/registry`. The image includes a registry seed copied from the repository `registry/` directory; on first startup, `docker/entrypoint.sh` copies `skills/` into `docker/data/registry/skills` if the mounted registry is empty.

## Package Upload

Supported package formats:

```text
package.tgz
package.tar.gz
package.zip
```

Manifest lookup inside a package supports:

```text
skill.json
manifest.json
package/skill.json
package/manifest.json
```

The server validates package structure, manifest schema, unsafe paths, links, sensitive files, publisher permission, and duplicate public versions. It does not execute package contents.

## Auth

The first registered user gets both `admin` and `publisher` roles. Later registered users get `publisher`.

Use bearer tokens:

```text
Authorization: Bearer <token>
```

Auth endpoints:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/auth/refresh
```

## Public API

```text
GET /health
GET /api/v1/skills
GET /api/v1/categories
GET /api/v1/tags
GET /api/v1/featured-skills
GET /api/v1/skills/:publisher/:name
GET /api/v1/skills/:publisher/:name/versions
GET /api/v1/skills/:publisher/:name/versions/:version/manifest
GET /api/v1/skills/:publisher/:name/versions/:version/package
```

`GET /api/v1/skills` supports:

```text
query
kind
tag
category
publisher
sort=latest|newest|updated|name
limit
```

`newest` and `updated` are compatibility aliases for `latest`.

Package download returns `application/gzip` for `.tgz` and `application/zip` for `.zip`, with `X-Skill-Id`, `X-Skill-Version`, and `X-Skill-Sha256` headers.

## Publisher API

```text
POST   /api/v1/publisher/submissions
GET    /api/v1/publisher/submissions
GET    /api/v1/publisher/submissions/:submissionId
POST   /api/v1/publisher/submissions/:submissionId/submit
POST   /api/v1/publisher/submissions/:submissionId/withdraw
DELETE /api/v1/publisher/submissions/:submissionId
GET    /api/v1/publisher/skills
GET    /api/v1/publisher/skills/:publisher/:name
```

`POST /api/v1/publisher/submissions` uses `multipart/form-data`:

```text
file: package.tgz | package.tar.gz | package.zip
releaseNotes?: string
changeNotes?: string
```

## Admin API

```text
GET  /api/v1/admin/reviews
GET  /api/v1/admin/reviews/:submissionId
POST /api/v1/admin/reviews/:submissionId/approve
POST /api/v1/admin/reviews/:submissionId/reject
POST /api/v1/admin/skills/:publisher/:name/versions/:version/remove
POST /api/v1/admin/skills/:publisher/:name/versions/:version/restore
POST /api/v1/admin/skills/:publisher/:name/feature
POST /api/v1/admin/skills/:publisher/:name/unfeature
```

Approve writes the normalized manifest and original package into the public registry. Reject and remove require a reason.

## Running

```powershell
npm install
npm run build
npm run start --workspace @qizhi/skill-market-server
```

Default:

```text
http://127.0.0.1:3100
```

Override:

```powershell
$env:PORT = "3200"
$env:HOST = "127.0.0.1"
$env:REGISTRY_ROOT = "C:\projects\skill-market\registry"
$env:CORS_ORIGIN = "http://localhost:5173,http://127.0.0.1:5173"
npm run start --workspace @qizhi/skill-market-server
```

By default, CORS allows common local frontend origins on ports `3000`, `4173`, and `5173`. Set `CORS_ORIGIN=false` to disable CORS or `CORS_ORIGIN=*` to allow any origin.

Docker commands use files under `docker/`:

```powershell
npm run docker:up
npm run docker:logs
npm run docker:down
```

Docker Compose starts two containers:

```text
skill-market-server  Backend API, exposed on http://localhost:3100
skill-market-web     Frontend site, exposed on http://localhost:7080
```

The web container serves `apps/web` through Nginx and proxies `/api/*` and `/health` to `skill-market-server:3100`.

Docker runtime data lands in `docker/data/registry`.

## Verification

```powershell
npm run build
npm run typecheck
npm test
```

Current tests cover:

- Shared schema parsing.
- Public registry scan/detail/versions/manifest/package APIs.
- `.tgz` and `.zip` package validation.
- Register, upload zip package, submit review, admin approve, public detail, and public zip package download.

Full endpoint details are in `docs/market-api.md`.

## API Contract Maintenance

`docs/market-api.md` is the frontend/backend contract. Any backend route, query parameter, enum value, request body, or response shape consumed by the frontend must be documented there.

When changing the API:

- Update shared schemas and exported types in `@qizhi/skill-spec` first when the payload is shared.
- Keep existing enum values as aliases for at least one minor version when renaming values.
- Update `docs/market-api.md`.
- Add or update a backend test covering the changed contract.
