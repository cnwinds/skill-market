# Market API v1

Base path:

```text
/api/v1
```

## GET /skills

Query:

```text
query?: string
kind?: instruction | runtime | hybrid
tag?: string
category?: string
limit?: number
cursor?: string
```

Response:

```json
{
  "skills": []
}
```

Each item must match `marketSkillSummarySchema` from `@qizhi/skill-spec`.

## GET /skills/{publisher}/{name}

Returns detail for a skill and its latest manifest.

## GET /skills/{publisher}/{name}/versions

Returns all visible versions, newest first.

## GET /skills/{publisher}/{name}/versions/{version}/manifest

Returns `skillManifestSchema`.

## GET /skills/{publisher}/{name}/versions/{version}/package

Returns `.tgz`.

Headers:

```text
Content-Type: application/gzip
X-Skill-Id: publisher/name
X-Skill-Version: 1.0.0
X-Skill-Sha256: <hex>
```
