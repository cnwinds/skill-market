# skill-market.md Specification v1.0

`skill-market.md` is a machine-readable and human-readable file served under `/.well-known/` on a SkillMarket instance. Tools use it to discover endpoints for installing and publishing Skills.

## Discovery

```
GET /.well-known/skill-market.md
```

> **Migration note:** The legacy path `/market.md` returns a `301` redirect to `/.well-known/skill-market.md`.

Returns `text/markdown; charset=utf-8`. The file is both parseable by tools and renderable as a human-readable page.

## File Format

The file consists of:

1. A YAML front matter block with instance metadata
2. Prose sections for human readers
3. Fenced code blocks with language `skill-market` containing structured YAML for tools

### Front Matter

```yaml
---
skillmarket: "1.0"   # spec version, required
baseUrl: "https://market.example.com"  # canonical base URL, required
apiVersion: "v1"     # API version, required
---
```

### skill-market Code Blocks

Tools scan the file for fenced code blocks with language identifier `skill-market` and parse their YAML content. Each block has an `action` field that identifies its purpose.

#### action: install

Describes how to browse and download Skills.

```yaml
action: install
baseUrl: https://market.example.com
api:
  list:    GET /api/v1/skills
  detail:  GET /api/v1/skills/{publisher}/{name}
  package: GET /api/v1/skills/{publisher}/{name}/versions/{version}/package
query:
  list: [query, kind, tag, category, publisher, sort, limit]
packageHeaders:
  skillId: X-Skill-Id
  version: X-Skill-Version
  sha256: X-Skill-Sha256
```

| Field | Description |
|---|---|
| `baseUrl` | Base URL to prepend to all relative paths |
| `api.list` | List/search skills. Supports query params: `query`, `kind`, `tag`, `category`, `publisher`, `sort`, `limit` |
| `api.detail` | Get skill detail and all versions |
| `api.package` | Download the skill package (`.tgz` or `.zip`) |
| `query.list` | Optional machine-readable list of supported list query params |
| `packageHeaders` | Optional response headers tools should use when verifying downloaded packages |

#### action: publish

Describes how to authenticate and publish Skills.

```yaml
action: publish
baseUrl: https://market.example.com
auth:
  apiKey:
    header: Authorization
    format: "Bearer {key}"
    manageUrl: https://market.example.com/publisher/keys
  login:
    endpoint: POST /api/v1/auth/login
    body: { email, password }
    tokenPath: token
api:
  upload: POST /api/v1/publisher/submissions
  submit: POST /api/v1/publisher/submissions/{id}/submit
  status: GET /api/v1/publisher/submissions/{id}
package:
  field: file
  formats: [package.tgz, package.tar.gz, package.zip]
```

| Field | Description |
|---|---|
| `auth.apiKey` | API Key auth method (recommended for CI/CD) |
| `auth.apiKey.header` | HTTP header name to use |
| `auth.apiKey.format` | Header value format; `{key}` is replaced with the key secret |
| `auth.apiKey.manageUrl` | Web UI URL where users can create and revoke keys |
| `auth.login` | Interactive login method |
| `auth.login.endpoint` | Login endpoint |
| `auth.login.body` | Required request body fields |
| `auth.login.tokenPath` | JSON path in the response where the token is found |
| `api.upload` | Upload a package (`multipart/form-data`, field `file`) |
| `api.submit` | Submit the uploaded package for review |
| `api.status` | Check submission status |
| `package.field` | Multipart file field name |
| `package.formats` | Supported upload package formats |

#### action: dev-install

Describes how tools can download private development versions for local testing.

```yaml
action: dev-install
baseUrl: https://market.example.com
auth:
  devKey:
    header: X-Skill-Dev-Key
    format: "{key}"
api:
  list:    GET /api/v1/dev/skills/{publisher}/{name}
  versions: GET /api/v1/dev/skills/{publisher}/{name}/versions
  manifest: GET /api/v1/dev/skills/{publisher}/{name}/versions/{version}/manifest
  package: GET /api/v1/dev/skills/{publisher}/{name}/versions/{version}/package
versionAliases: [dev, latest-dev]
packageHeaders:
  skillId: X-Skill-Id
  version: X-Skill-Version
  sha256: X-Skill-Sha256
  channel: X-Skill-Channel
```

Tools must use `X-Skill-Dev-Key`, verify `X-Skill-Sha256`, and treat development packages as local-test-only. Development installs should not overwrite public installs unless the user explicitly confirms.

## Publish Workflow

Tools implementing publish support must follow this sequence:

1. **Authenticate** — obtain a bearer token via API Key or login
2. **Upload** — `POST /api/v1/publisher/submissions` with `multipart/form-data`, field `file` containing the `.tgz` or `.zip` package. Returns a submission object with an `id` and `status: "draft"`.
3. **Submit** — `POST /api/v1/publisher/submissions/{id}/submit`. Moves the submission to `pending_review`.
4. **Poll** — `GET /api/v1/publisher/submissions/{id}` to check status. Terminal states: `published`, `rejected`, `withdrawn`.

## Authentication Methods

### API Key (recommended)

Generate a Publish Key in the web UI at the URL given in `auth.apiKey.manageUrl`. Keys are prefixed `skpub_` and can be copied again by the owning publisher or an admin.

Use the key as a bearer token on every request:

```
Authorization: Bearer skpub_...
```

API Keys are scoped to a publisher namespace and can be revoked at any time.

### Login

For interactive tools, call the login endpoint with email and password:

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "you@example.com", "password": "..." }
```

The response contains a `token` field. Use it as `Authorization: Bearer <token>`. Tokens expire after 30 days.

## Install Workflow

1. **Discover** — `GET /api/v1/skills` with optional filters
2. **Resolve version** — `GET /api/v1/skills/{publisher}/{name}` to find the latest version
3. **Download** — `GET /api/v1/skills/{publisher}/{name}/versions/{version}/package`

The package response includes headers:

```
X-Skill-Id: publisher/name
X-Skill-Version: 1.0.0
X-Skill-Sha256: <hex>
```

Verify the SHA-256 checksum after download.

## Tool Implementation Notes

- Parse `skill-market` blocks in document order; later blocks with the same `action` override earlier ones
- Unknown fields in blocks must be ignored (forward compatibility)
- The `baseUrl` in the front matter is the canonical URL; `baseUrl` inside blocks may differ (e.g., CDN for packages)
- Tools should cache `skill-market.md` for up to 60 seconds (`cache-control: public, max-age=60`)
- Tools should first try `/.well-known/skill-market.md`; the legacy path `/market.md` may redirect
