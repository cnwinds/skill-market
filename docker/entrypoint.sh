#!/bin/sh
set -eu

REGISTRY_ROOT="${REGISTRY_ROOT:-/app/registry}"
REGISTRY_SEED_ROOT="${REGISTRY_SEED_ROOT:-/app/registry-seed}"

mkdir -p "$REGISTRY_ROOT"

if [ ! -d "$REGISTRY_ROOT/skills" ] && [ -d "$REGISTRY_SEED_ROOT/skills" ]; then
  cp -R "$REGISTRY_SEED_ROOT/skills" "$REGISTRY_ROOT/skills"
fi

exec "$@"
