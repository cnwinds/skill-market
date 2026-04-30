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

### POST /publisher/publish-keys

Creates a Publish Key for automated publishing. The caller must be able to publish for the requested publisher.

Request:

```json
{
  "name": "GitHub Actions",
  "publisher": "alice",
  "expiresAt": "2026-12-31T00:00:00.000Z"
}
```

`expiresAt` is optional.

Response matches `marketPublishKeyResponseSchema`. The `secret` field is returned and can be copied again later by the owning publisher or an admin.

### GET /publisher/publish-keys

Query:

```text
publisher?: string
```

Returns Publish Keys accessible to the current user, including their `secret` values when available. Older keys created before secret persistence may not include `secret`.

### POST /publisher/publish-keys/{keyId}/revoke

Revokes a Publish Key accessible to the current user.

Response matches `marketPublishKeyResponseSchema`.

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

### POST /publisher/skills/{publisher}/{name}/edit-workspaces

Creates an editable workspace from a published version. The caller must be an owner of the publisher or an admin.

Request:

```json
{
  "sourceVersion": "1.0.0",
  "targetVersion": "1.0.1"
}
```

Both fields are optional. `sourceVersion` defaults to the latest public version. `targetVersion` defaults to a patch bump of the source version. The server updates the unpacked manifest version to `targetVersion`.

Response matches `marketEditWorkspaceResponseSchema`.

### GET /publisher/edit-workspaces

Query:

```text
skillId?: publisher/name
status?: draft | validating | ready | submitted | published | discarded
```

Returns workspaces accessible to the current user:

```json
{
  "workspaces": []
}
```

Each item matches `marketEditWorkspaceSchema`.

### GET /publisher/edit-workspaces/{workspaceId}

Returns one workspace matching `marketEditWorkspaceResponseSchema`.

### PATCH /publisher/edit-workspaces/{workspaceId}

Updates workspace metadata.

```json
{
  "targetVersion": "1.0.2",
  "baseRevision": 3
}
```

Returns `marketEditWorkspaceResponseSchema`. Stale `baseRevision` returns `409`.

### GET /publisher/edit-workspaces/{workspaceId}/files

Query:

```text
path?: directory path
```

Returns direct children of the directory and the current workspace revision:

```json
{
  "path": "",
  "entries": [],
  "revision": 1
}
```

`entries[]` matches `marketWorkspaceFileEntrySchema`.

### GET /publisher/edit-workspaces/{workspaceId}/files/content

Query:

```text
path: file path
```

Returns UTF-8 text file content. Binary files return an error.

### GET /publisher/edit-workspaces/{workspaceId}/files/download

Downloads one workspace file. Requires auth and workspace access.

### PUT /publisher/edit-workspaces/{workspaceId}/files/content

Writes a UTF-8 text file:

```json
{
  "path": "SKILL.md",
  "content": "# Example\n",
  "baseRevision": 1
}
```

Returns `marketEditWorkspaceResponseSchema`.

### POST /publisher/edit-workspaces/{workspaceId}/files

Creates a file or directory:

```json
{
  "path": "docs/usage.md",
  "kind": "file",
  "content": "",
  "baseRevision": 2
}
```

### POST /publisher/edit-workspaces/{workspaceId}/files/upload

Uploads a binary file into the workspace.

Content type:

```text
multipart/form-data
```

Fields:

```text
path: assets/icon.png
baseRevision: 3
file: binary file
```

### PATCH /publisher/edit-workspaces/{workspaceId}/files/move

Moves or renames a workspace file or directory.

```json
{
  "from": "old.md",
  "to": "docs/new.md",
  "baseRevision": 4
}
```

### DELETE /publisher/edit-workspaces/{workspaceId}/files

Query:

```text
path: file or directory path
baseRevision: number
```

Returns `marketEditWorkspaceResponseSchema`.

### POST /publisher/edit-workspaces/{workspaceId}/validate

Packs the current workspace into a temporary `.tgz`, validates it with the same package validator used by uploads, and stores the result on the workspace.

Response:

```json
{
  "workspace": {},
  "validation": {},
  "manifest": {},
  "fileEntries": []
}
```

### POST /publisher/edit-workspaces/{workspaceId}/submit

Validates and submits the workspace package for review.

```json
{
  "releaseNotes": "Release notes",
  "changeNotes": "Change notes"
}
```

Returns `marketSubmissionResponseSchema`.

### GET /publisher/edit-workspaces/{workspaceId}/dev-releases

Returns development versions generated from the workspace:

```json
{
  "devReleases": []
}
```

Each item matches `marketDevReleaseSchema`.

### POST /publisher/edit-workspaces/{workspaceId}/dev-releases

Validates the workspace and creates a private development release. Development releases do not appear in public skill APIs.

```json
{
  "version": "1.0.1-dev.1",
  "label": "local test",
  "expiresAt": "2026-05-28T00:00:00.000Z"
}
```

`version` is optional and defaults to the workspace `targetVersion`. `expiresAt` defaults to 30 days after creation.

### POST /publisher/dev-keys

Creates a developer key for testing development releases.

```json
{
  "name": "Local SkillChat",
  "skillId": "alice/example",
  "expiresAt": "2026-05-28T00:00:00.000Z"
}
```

Response matches `marketDeveloperKeyResponseSchema`. The `secret` field can be viewed again later by the skill owner or an admin.

### GET /publisher/dev-keys

Query:

```text
skillId?: publisher/name
```

Returns developer keys accessible to the current user, including their `secret` values.

### POST /publisher/dev-keys/{keyId}/revoke

Revokes a developer key. Revoked keys can no longer download development releases.

### POST /publisher/dev-releases/{devReleaseId}/revoke

Revokes a development release.

```json
{
  "reason": "superseded"
}
```

## Development Download

Development download endpoints do not use login bearer tokens. Clients must send:

```text
X-Skill-Dev-Key: skdev_...
```

The key must be active, unexpired, include `dev:read`, and match the requested skill scope.

### GET /dev/skills/{publisher}/{name}

Returns active development releases for a skill.

### GET /dev/skills/{publisher}/{name}/versions

Returns active development releases for a skill.

### GET /dev/skills/{publisher}/{name}/versions/{version}/manifest

Returns the development release manifest. `{version}` may be a concrete dev version, `dev`, or `latest-dev`.

### GET /dev/skills/{publisher}/{name}/versions/{version}/package

Downloads the development release package. `{version}` may be a concrete dev version, `dev`, or `latest-dev`.

Headers include:

```text
X-Skill-Id: publisher/name
X-Skill-Version: <resolved version>
X-Skill-Sha256: <hex>
X-Skill-Channel: dev
```

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

### POST /admin/edit-workspaces/{workspaceId}/publish

Validates an editor workspace and publishes it directly into the public registry. Admin only.

```json
{
  "releaseNotes": "Release notes",
  "changeNotes": "Change notes",
  "reason": "Reviewed by admin"
}
```

Returns `marketSubmissionResponseSchema`.

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
