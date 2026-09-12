#!/usr/bin/env bash
# Disposable, credential-free Docker verification. Never use against a live host.
set -euo pipefail
cd "$(dirname "$0")"
export COMPOSE_PROJECT_NAME="postiz-verification-${GITHUB_RUN_ID:-$$}"
export POSTIZ_IMAGE=accelerate-postiz:verification
export POSTIZ_HOST=http://:80
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
      FRONTEND_URL: http://localhost:5080
      NEXT_PUBLIC_BACKEND_URL: http://localhost:5000/api
      NOT_SECURED: "true"
      DISABLE_REGISTRATION: "false"
  verification-proxy:
    image: ${CADDY_IMAGE}
    ports: ["127.0.0.1:5080:80"]
    environment:
      POSTIZ_HOST: http://:80
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./source:/srv/source:ro
YAML
compose=(docker compose -f compose.yaml -f verification.override.yaml)
cleanup() {
  code=$?
  "${compose[@]}" ps --format json > evidence/services.json || true
  node diagnose-service.mjs || true
  # Do not upload arbitrary service logs, which may contain bootstrap tokens.
  "${compose[@]}" down -v --remove-orphans >/dev/null || true
  rm -f verification.override.yaml private-verification-fixtures.json evidence/fixture-db.dump evidence/fixture-uploads.tar.gz evidence/fixture-temporal.dump evidence/fixture-temporal_visibility.dump private-temporal-history.json
  exit "$code"
}
trap cleanup EXIT
"${compose[@]}" up -d postiz verification-proxy
wait_ready() {
  for attempt in $(seq 1 90); do
    if "${compose[@]}" exec -T postiz node /opt/accelerate-healthcheck.mjs; then return 0; fi
    sleep 5
  done
  node diagnose-service.mjs || true
  echo 'Postiz frontend, backend or publishing worker did not become healthy.' >&2
  return 1
}
wait_ready
node verify-service.mjs bootstrap
"${compose[@]}" restart postiz
wait_ready
node verify-service.mjs restart
node verify-temporal-restore.mjs before
# Quiesce all writers before the matching DB + upload snapshot.
"${compose[@]}" stop postiz temporal
"${compose[@]}" exec -T postgres pg_dump -U postiz -d postiz -Fc > evidence/fixture-db.dump
for database in temporal temporal_visibility; do
  "${compose[@]}" exec -T temporal-db pg_dump -U temporal -d "$database" -Fc > "evidence/fixture-$database.dump"
done
"${compose[@]}" run --rm --no-deps --entrypoint tar postiz -czf - -C /uploads . > evidence/fixture-uploads.tar.gz
# Recreate only this disposable project's application data, then restore it.
"${compose[@]}" exec -T postgres dropdb --force -U postiz postiz
"${compose[@]}" exec -T postgres createdb -U postiz postiz
"${compose[@]}" exec -T postgres pg_restore -U postiz -d postiz < evidence/fixture-db.dump
for database in temporal temporal_visibility; do
  "${compose[@]}" exec -T temporal-db dropdb --force -U temporal "$database"
  "${compose[@]}" exec -T temporal-db createdb -U temporal "$database"
  "${compose[@]}" exec -T temporal-db pg_restore -U temporal -d "$database" < "evidence/fixture-$database.dump"
done
"${compose[@]}" run --rm --no-deps --entrypoint sh postiz -c 'find /uploads -mindepth 1 -delete'
"${compose[@]}" run --rm -T --no-deps --entrypoint tar postiz -xzf - -C /uploads < evidence/fixture-uploads.tar.gz
"${compose[@]}" up -d postiz
wait_ready
node verify-temporal-restore.mjs after
node verify-service.mjs restore
# Fixture credentials and database contents do not belong in CI artifacts.
rm -f evidence/fixture-db.dump evidence/fixture-uploads.tar.gz evidence/fixture-temporal.dump evidence/fixture-temporal_visibility.dump private-temporal-history.json private-verification-fixtures.json
