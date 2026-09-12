#!/usr/bin/env bash
# Disposable, credential-free Docker verification. Never use against a live host.
set -euo pipefail
cd "$(dirname "$0")"
export COMPOSE_PROJECT_NAME="postiz-verification-${GITHUB_RUN_ID:-$$}"
export POSTIZ_IMAGE=accelerate-postiz:verification
export POSTIZ_HOST=localhost
export POSTIZ_JWT_SECRET=$(openssl rand -hex 32)
export POSTIZ_DB_PASSWORD=$(openssl rand -hex 32)
export TEMPORAL_DB_PASSWORD=$(openssl rand -hex 32)
export LINKEDIN_CLIENT_ID=isolated-verification-no-provider
export LINKEDIN_CLIENT_SECRET=isolated-verification-no-provider
mkdir -p evidence
umask 077
for pair in 'CADDY_IMAGE caddy:2' 'POSTGRES_IMAGE postgres:17' 'REDIS_IMAGE redis:7' 'TEMPORAL_POSTGRES_IMAGE postgres:16' 'TEMPORAL_IMAGE temporalio/auto-setup:1.28.1'; do
  read -r variable reference <<< "$pair"
  docker pull "$reference" >/dev/null
  digest=$(docker inspect --format '{{index .RepoDigests 0}}' "$reference")
  export "$variable=$digest"
  printf '%s=%s\n' "$variable" "$digest" >> evidence/images.txt
done
docker image inspect --format '{{.Id}}' "$POSTIZ_IMAGE" > evidence/postiz-image-id.txt
cat > verification.override.yaml <<'YAML'
services:
  postiz:
    ports: ["127.0.0.1:5000:5000"]
    environment:
      MAIN_URL: http://localhost:5000
      FRONTEND_URL: http://localhost:5000
      NEXT_PUBLIC_BACKEND_URL: http://localhost:5000/api
      NOT_SECURED: "true"
      DISABLE_REGISTRATION: "false"
YAML
compose=(docker compose -f compose.yaml -f verification.override.yaml)
cleanup() {
  code=$?
  "${compose[@]}" ps --format json > evidence/services.json || true
  # Do not upload arbitrary service logs, which may contain bootstrap tokens.
  "${compose[@]}" down -v --remove-orphans >/dev/null || true
  rm -f verification.override.yaml private-verification-fixtures.json evidence/fixture-db.dump evidence/fixture-uploads.tar.gz
  exit "$code"
}
trap cleanup EXIT
"${compose[@]}" up -d postiz
for attempt in $(seq 1 90); do
  if curl -fsS http://localhost:5000/api/auth/can-register >/dev/null; then break; fi
  sleep 5
done
curl -fsS http://localhost:5000/api/auth/can-register >/dev/null
node verify-service.mjs bootstrap
"${compose[@]}" restart postiz
for attempt in $(seq 1 60); do
  if curl -fsS http://localhost:5000/api/auth/can-register >/dev/null; then break; fi
  sleep 5
done
node verify-service.mjs restart
# Quiesce all writers before the matching DB + upload snapshot.
"${compose[@]}" stop postiz temporal
"${compose[@]}" exec -T postgres pg_dump -U postiz -d postiz -Fc > evidence/fixture-db.dump
"${compose[@]}" run --rm --no-deps --entrypoint tar postiz -czf - -C /uploads . > evidence/fixture-uploads.tar.gz
# Recreate only this disposable project's application data, then restore it.
"${compose[@]}" exec -T postgres dropdb -U postiz postiz
"${compose[@]}" exec -T postgres createdb -U postiz postiz
"${compose[@]}" exec -T postgres pg_restore -U postiz -d postiz < evidence/fixture-db.dump
"${compose[@]}" run --rm --no-deps --entrypoint sh postiz -c 'find /uploads -mindepth 1 -delete'
"${compose[@]}" run --rm -T --no-deps --entrypoint tar postiz -xzf - -C /uploads < evidence/fixture-uploads.tar.gz
"${compose[@]}" start temporal postiz
for attempt in $(seq 1 60); do
  if curl -fsS http://localhost:5000/api/auth/can-register >/dev/null; then break; fi
  sleep 5
done
node verify-service.mjs restore
# Fixture credentials and database contents do not belong in CI artifacts.
rm -f evidence/fixture-db.dump evidence/fixture-uploads.tar.gz evidence/private-fixtures.json
