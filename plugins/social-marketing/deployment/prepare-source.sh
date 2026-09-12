#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
revision=3cbe20b86bf3b2243843d51bb63dcec8773babf7
if [[ -e upstream ]]; then
  echo 'Retain the existing upstream directory. Prepare a new release directory for another build.' >&2
  exit 1
fi
git clone --no-checkout https://github.com/gitroomhq/postiz-app.git upstream
git -C upstream checkout --detach "$revision"
test "$(git -C upstream rev-parse HEAD)" = "$revision"
git -C upstream apply --check ../identity.patch
git -C upstream apply ../identity.patch
mkdir -p source
tar --exclude=.git -czf source/postiz-source.tar.gz -C upstream .
printf '%s\n' "$revision" > source/UPSTREAM-REVISION
cp upstream/LICENSE source/LICENSE
shasum -a 256 source/postiz-source.tar.gz > source/SHA256SUMS
printf '%s\n' 'Source is prepared. Build upstream/Dockerfile.dev, publish the image to your registry and record its immutable digest before starting Compose.'
