#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# Export the private release environment first. Never print Compose's resolved secrets.
for variable in POSTIZ_IMAGE CADDY_IMAGE POSTGRES_IMAGE REDIS_IMAGE TEMPORAL_POSTGRES_IMAGE TEMPORAL_IMAGE; do
  value="${!variable:-}"
  if [[ ! "$value" =~ ^[a-zA-Z0-9./:_-]+@sha256:[a-f0-9]{64}$ ]]; then
    printf 'Missing immutable image digest: %s\n' "$variable" >&2
    exit 1
  fi
done
if [[ ! "${POSTIZ_HOST:-}" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
  echo 'Set POSTIZ_HOST to the HTTPS hostname without a scheme or path.' >&2
  exit 1
fi
for variable in POSTIZ_JWT_SECRET POSTIZ_DB_PASSWORD TEMPORAL_DB_PASSWORD; do
  value="${!variable:-}"
  if [[ ! "$value" =~ ^[a-zA-Z0-9_-]{32,}$ ]]; then
    printf 'Set a URL-safe random secret of at least 32 characters: %s\n' "$variable" >&2
    exit 1
  fi
done
test -s source/postiz-source.tar.gz
test -s source/LICENSE
shasum -a 256 --check source/SHA256SUMS
docker compose config --quiet
printf '%s\n' 'Release configuration and source checksum validated. Live health, tenant isolation, publication and restore proof are still required.'
