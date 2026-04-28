# Docker Layout

Docker-related files live in this directory.

```text
docker/
  Dockerfile
  Dockerfile.dockerignore
  compose.yml
  entrypoint.sh
  data/
    registry/
```

Runtime data from Docker Compose lands in:

```text
docker/data/registry
```

This directory is mounted into the container as:

```text
/app/registry
```

On first container startup, `entrypoint.sh` seeds `docker/data/registry/skills`
from the image's bundled `registry/skills` if the mounted registry is empty.
After that, uploaded submissions, users, sessions, audit logs, review results,
published packages, and removed markers are all persisted under
`docker/data/registry`.

Commands from the repository root:

```powershell
npm run docker:build
npm run docker:up
npm run docker:logs
npm run docker:down
```

Equivalent Compose command:

```powershell
docker compose -f docker/compose.yml up -d --build
```

To reset all Docker runtime data, stop the service and remove the contents of
`docker/data/registry`.
