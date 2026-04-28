# Market API v1

This document is the frontend/backend contract for SkillMarket. Any backend route,
query parameter, enum value, request body, or response shape used by the frontend
must be documented here before frontend integration.

Contract maintenance rules:

- Reuse schemas and exported types from `@qizhi/skill-spec` whenever a payload is shared with the frontend.
- Add new enum values instead of replacing existing values. If a rename is needed, keep the old value as an alias for at least one minor version.
- Unknown query parameters are ignored unless this document says otherwise.
- All error responses use `{ "error": "message" }`; validation errors may also include `details`.
- When an endpoint changes, update this document, `@qizhi/skill-spec`, and at least one backend test in the same change.

Base path:

```text
/api/v1
```

Authentication uses bearer tokens returned by login/register:

```text
Authorization: Bearer <token>
```

For local frontend development, the server allows common localhost CORS origins by default: `3000`, `4173`, and `5173`. Configure with `CORS_ORIGIN`, for example:

```text
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

## Public

### GET /skills

Query:

```text
query?: string
kind?: instruction | runtime | hybrid
tag?: string
category?: string
publisher?: string
sort?: latest | newest | updated | name
limit?: number
```

Response:

```json
{
  "skills": []
}
```

Each item matches `marketSkillSummarySchema` from `@qizhi/skill-spec`.

`newest` and `updated` are accepted aliases for `latest`.
`limit` defaults to `50` and is capped at `100`.
`offset` is not supported in v1 and is ignored if sent by the frontend.

### GET /skills/{publisher}/{name}

Returns detail for a skill and all public versions.

### GET /skills/{publisher}/{name}/versions

Returns all public versions, newest first.

### GET /skills/{publisher}/{name}/versions/{version}/manifest

Returns `skillManifestSchema`.

### GET /skills/{publisher}/{name}/versions/{version}/package

Returns the original uploaded package. Supported public package formats:

```text
package.tgz
package.zip
```

Headers:

```text
Content-Type: application/gzip | application/zip
Content-Disposition: attachment; filename="package.tgz" | attachment; filename="package.zip"
X-Skill-Id: publisher/name
X-Skill-Version: 1.0.0
X-Skill-Sha256: <hex>
```

### GET /categories

Returns public category counts:

```json
{
  "categories": [
    { "name": "documents", "count": 3 }
  ]
}
```

### GET /tags

Returns public tag counts.

### GET /featured-skills

Returns public skills marked as featured by an admin.

## Auth

### POST /auth/register

The first registered user becomes both `publisher` and `admin`. Later users become `publisher`.

Request:

```json
{
  "email": "alice@example.com",
  "password": "password123",
  "displayName": "Alice",
  "publisher": "alice"
}
```

Response:

```json
{
  "user": {
    "id": "user_...",
    "email": "alice@example.com",
    "displayName": "Alice",
    "roles": ["publisher", "admin"],
    "publishers": ["alice"],
    "createdAt": "...",
    "updatedAt": "..."
  },
  "token": "..."
}
```

### POST /auth/login

Request:

```json
{
  "email": "alice@example.com",
  "password": "password123"
}
```

Returns the same shape as register.

### POST /auth/logout

Revokes the current bearer token.

### GET /auth/me

Returns:

```json
{
  "user": null
}
```

or the authenticated user.

### POST /auth/refresh

Requires auth. Revokes the current token and returns a new token.

## Publisher

All publisher endpoints require auth.

### POST /publisher/submissions

Uploads a package and creates a draft submission.

Content type:

```text
multipart/form-data
```

Fields:

```text
file: package.tgz | package.tar.gz | package.zip
releaseNotes?: string
changeNotes?: string
```

Package manifest lookup supports:

```text
skill.json
manifest.json
package/skill.json
package/manifest.json
```

Response:

```json
{
  "submission": {
    "id": "sub_...",
    "status": "draft",
    "skillId": "alice/example",
    "publisher": "alice",
    "name": "example",
    "version": "1.0.0",
    "manifest": {},
    "package": {
      "filename": "package.zip",
      "format": "zip",
      "contentType": "application/zip",
      "sizeBytes": 1234,
      "checksumSha256": "..."
    },
    "fileEntries": [],
    "validation": {
      "valid": true,
      "errors": [],
      "warnings": []
    },
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

Validation errors keep the submission as a draft so the frontend can display problems.

### GET /publisher/submissions

Query:

```text
status?: draft | pending_review | approved | rejected | published | withdrawn | removed
```

Returns the current user's submissions.

### GET /publisher/submissions/{submissionId}

Returns one submission owned by the current user.

### POST /publisher/submissions/{submissionId}/submit

Submits a valid draft or rejected submission for admin review.

Request:

```json
{
  "releaseNotes": "Initial release",
  "changeNotes": "Added support for x"
}
```

### POST /publisher/submissions/{submissionId}/withdraw

Withdraws a pending review submission.

### DELETE /publisher/submissions/{submissionId}

Deletes a draft, rejected, or withdrawn submission.

### GET /publisher/skills

Returns public skills owned by the current user's publishers plus the user's submissions.

Response:

```json
{
  "skills": [],
  "submissions": []
}
```

`skills[]` matches `marketSkillSummarySchema`.
`submissions[]` matches `marketSubmissionSchema`.

### GET /publisher/skills/{publisher}/{name}

Returns one owned skill detail plus related submissions.

Response:

```json
{
  "skill": null,
  "submissions": []
}
```

`skill` is `marketSkillDetailSchema | null`.
`submissions[]` matches `marketSubmissionSchema`.

## Admin

All admin endpoints require an authenticated user with `admin` role.

### GET /admin/reviews

Query:

```text
status?: draft | pending_review | approved | rejected | published | withdrawn | removed
```

Defaults to `pending_review`.

### GET /admin/reviews/{submissionId}

Returns one submission for review.

### POST /admin/reviews/{submissionId}/approve

Approves a pending submission and writes it into the public registry:

```text
registry/skills/{publisher}/{name}/{version}/manifest.json
registry/skills/{publisher}/{name}/{version}/package.tgz | package.zip
```

Request:

```json
{
  "reason": "Looks good"
}
```

### POST /admin/reviews/{submissionId}/reject

Rejects a pending submission. `reason` is required.

```json
{
  "reason": "Permission declaration is not clear"
}
```

### POST /admin/skills/{publisher}/{name}/versions/{version}/remove

Writes `removed.json` into the version directory. Removed versions are hidden from all public APIs and downloads.

```json
{
  "reason": "Security issue"
}
```

### POST /admin/skills/{publisher}/{name}/versions/{version}/restore

Removes `removed.json` and makes the version public again.

### POST /admin/skills/{publisher}/{name}/feature

Marks a public skill as featured.

### POST /admin/skills/{publisher}/{name}/unfeature

Removes the featured marker.

## Storage

The backend currently uses file storage:

```text
registry/
  skills/
  market-data/
    market.json
    uploads/
```

`registry/skills` remains the public read-only distribution registry. `registry/market-data` stores users, bearer sessions, submissions, audit logs, featured skill ids, and uploaded draft packages.
