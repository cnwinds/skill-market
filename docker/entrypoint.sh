#!/bin/sh
set -eu

REGISTRY_ROOT="${REGISTRY_ROOT:-/app/registry}"
REGISTRY_SEED_ROOT="${REGISTRY_SEED_ROOT:-/app/registry-seed}"

mkdir -p "$REGISTRY_ROOT"

if [ -d "$REGISTRY_SEED_ROOT/skills" ]; then
  mkdir -p "$REGISTRY_ROOT/skills"
  if [ -z "$(find "$REGISTRY_ROOT/skills" -mindepth 1 -maxdepth 1 ! -name '.gitignore' -print -quit)" ]; then
    cp -R "$REGISTRY_SEED_ROOT/skills/." "$REGISTRY_ROOT/skills/"
  fi
fi

exec "$@"
