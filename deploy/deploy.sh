#!/usr/bin/env bash
# A game's deploy/deploy.sh (kitten/deploy/game-deploy-shim.sh; `kitten new` writes it). It finds kitten's
# game-deploy.sh and runs it for this game, with this folder's game.conf. Every argument passes through:
#
#   deploy/deploy.sh plan                 what game.conf resolves to (hosts, builds, limits)
#   deploy/deploy.sh --dry-run            every step of a deploy, printed; nothing built or sent
#   deploy/deploy.sh setup [--dry-run]    a server game, once: its user, unit and Caddy site on realtime-1
#   deploy/deploy.sh                      build, publish the client, then (with a server) activate it
#   deploy/deploy.sh rollback | status | logs | stage | pages-sync
#
# The driver, first found wins:
#   1. GAME_DEPLOY=/path/to/game-deploy.sh;
#   2. kitten/deploy/game-deploy.sh in a folder up this tree (a hornet-web checkout, or a game that vendors kitten
#      at kitten/);
#   3. deploy/kit/game-deploy.sh beside this file (the copy `kitten new` vendors; kitten.lock records it).
# The game dir is this folder's git repo root, so a game in a subfolder (Jetling: apps/xr-jet/deploy/) builds from
# the root. The realtime host's tools are found through RT_TOOLS (kitten/README.md "Deploy").
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
driver="${GAME_DEPLOY:-}"
dir="$HERE"
while [ -z "$driver" ] && [ "$dir" != / ]; do
  dir="$(dirname "$dir")"
  [ ! -x "$dir/kitten/deploy/game-deploy.sh" ] || driver="$dir/kitten/deploy/game-deploy.sh"
done
[ -n "$driver" ] || [ ! -x "$HERE/kit/game-deploy.sh" ] || driver="$HERE/kit/game-deploy.sh"
if [ -z "$driver" ]; then
  echo "deploy: no game-deploy.sh: none at kitten/deploy/ up from $HERE, and no $HERE/kit/ (kitten update vendors it); or set GAME_DEPLOY=/path/to/game-deploy.sh" >&2
  exit 1
fi
root="$(git -C "$HERE" rev-parse --show-toplevel 2>/dev/null)" || root="$(dirname "$HERE")"
echo "deploy: $driver" >&2
exec "$driver" -C "$root" --conf "$HERE/game.conf" "$@"
