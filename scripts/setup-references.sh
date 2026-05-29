#!/usr/bin/env bash
#
# setup-references.sh — reconstruct the untracked ./references folder.
#
# ./references is git-ignored (it holds large upstream engines we study for the
# SOTA roadmap, see docs/SOTA_ROADMAP.md). It is NOT part of the repo, so a fresh
# checkout (e.g. a cloud CI runner) won't have it. This script rebuilds it by
# cloning each upstream repository pinned to the EXACT commit it was captured at.
#
# Design notes:
#   * HTTPS remotes (no SSH key needed on a cloud runner; all repos are public).
#   * Each repo is fetched as a single, depth-1 commit at its pinned SHA — this
#     gives the full working tree at that commit with no history, keeping the
#     download as small as possible. (GitHub allows fetching an arbitrary SHA.)
#   * Idempotent: a repo already checked out at the pinned SHA is skipped.
#   * kenney_platformer-kit is a CC0 asset pack (not a git repo). It is restored
#     by default from kenney.nl (override via $KENNEY_PLATFORMER_KIT_URL), and a
#     download failure is NON-FATAL — the playground's required GLBs are vendored
#     under playground/public/assets/kenney/ (tracked), so builds/tests never
#     need this full pack; it is kept only as study material.
#
# Usage:
#   scripts/setup-references.sh            # restore anything missing/out-of-date
#   scripts/setup-references.sh --force    # re-clone every repo from scratch
#   scripts/setup-references.sh --full     # full clone (with history) instead of depth-1
#   KENNEY_PLATFORMER_KIT_URL=https://… scripts/setup-references.sh   # also fetch the asset pack
#
set -euo pipefail

# ---- resolve repo root regardless of CWD --------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REF_DIR="$ROOT/references"

FORCE=""
DEPTH_ARGS=(--depth 1)
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --full)  DEPTH_ARGS=() ;;
    -h|--help)
      cat <<'USAGE'
setup-references.sh — reconstruct the untracked ./references folder by cloning
each upstream engine pinned to the exact commit it was captured at.

  scripts/setup-references.sh           restore anything missing/out-of-date
  scripts/setup-references.sh --force   re-clone every repo from scratch
  scripts/setup-references.sh --full    full clone (with history) not depth-1

Env:
  KENNEY_PLATFORMER_KIT_URL=<zip-url>   override the default kenney.nl download
USAGE
      exit 0 ;;
    *) echo "unknown argument: $arg (try --help)" >&2; exit 2 ;;
  esac
done

command -v git >/dev/null 2>&1 || { echo "error: git is required" >&2; exit 1; }
mkdir -p "$REF_DIR"

# ---- pinned upstream repositories ---------------------------------------------
# Format: "dir|https-url|pinned-sha|human-readable-ref"
# Update the SHA here whenever you intentionally re-capture a reference.
REPOS=(
  "bevy|https://github.com/bevyengine/bevy.git|370be1b02fc93a4bfabf61fb2fc66cf2affca495|main @ v0.16.0-rc.4+2713"
  "engine|https://github.com/playcanvas/engine.git|a4cdaf35cb4651809f829670a22778395da71dc6|PlayCanvas main @ ~v2.13.0-beta.1+512"
  "three-mesh-bvh|https://github.com/gkjohnson/three-mesh-bvh.git|30811dc01a8c58099873340d4a1f91d11a9aeb73|v0.9.10"
  "three.js|https://github.com/mrdoob/three.js.git|2654e309863f6f93e9c77c302521b00c85c89dc5|dev @ r184+148"
)

ok=0; skipped=0; failed=0

clone_pinned() {
  local name="$1" url="$2" sha="$3" ref="$4"
  local target="$REF_DIR/$name"

  if [ -d "$target/.git" ] && [ -z "$FORCE" ]; then
    local current
    current="$(git -C "$target" rev-parse HEAD 2>/dev/null || echo "")"
    if [ "$current" = "$sha" ]; then
      echo "  ✓ $name — already at $sha (skip)"
      skipped=$((skipped + 1))
      return 0
    fi
    echo "  ↻ $name — at ${current:0:12}, want ${sha:0:12}; re-cloning"
  fi

  echo "  → $name  ($ref)"
  rm -rf "$target"
  mkdir -p "$target"
  git init -q "$target"
  git -C "$target" remote add origin "$url"

  # Primary: minimal single-commit fetch at the exact SHA.
  if git -C "$target" fetch -q ${DEPTH_ARGS[@]+"${DEPTH_ARGS[@]}"} origin "$sha" 2>/dev/null; then
    git -C "$target" -c advice.detachedHead=false checkout -q FETCH_HEAD
  else
    # Fallback: some servers/mirrors disallow by-SHA fetch — pull full history then check out.
    echo "    (depth-1 SHA fetch unavailable; falling back to full fetch)"
    git -C "$target" fetch -q origin
    git -C "$target" -c advice.detachedHead=false checkout -q "$sha"
  fi

  local got
  got="$(git -C "$target" rev-parse HEAD)"
  if [ "$got" != "$sha" ]; then
    echo "  ✗ $name — checked out $got, expected $sha" >&2
    failed=$((failed + 1))
    return 1
  fi
  ok=$((ok + 1))
}

# CC0 "Platformer Kit" (4.1) from kenney.nl; override via $KENNEY_PLATFORMER_KIT_URL.
KENNEY_DEFAULT_URL="https://kenney.nl/media/pages/assets/platformer-kit/1585cf62b4-1775122253/kenney_platformer-kit.zip"

restore_kenney() {
  local name="kenney_platformer-kit"
  local target="$REF_DIR/$name"
  local url="${KENNEY_PLATFORMER_KIT_URL:-$KENNEY_DEFAULT_URL}"

  if [ -d "$target" ] && [ -n "$(ls -A "$target" 2>/dev/null)" ] && [ -z "$FORCE" ]; then
    echo "  ✓ $name — present (skip)"
    skipped=$((skipped + 1))
    return 0
  fi

  # Best-effort: this pack is study-only; any failure is a WARNING, never fatal,
  # because the playground's required GLBs are vendored under
  # playground/public/assets/kenney/ (tracked).
  if ! command -v curl >/dev/null 2>&1 || ! command -v unzip >/dev/null 2>&1; then
    echo "  ⏭  $name — skipped (need 'curl' + 'unzip'; optional study-only pack)"
    return 0
  fi

  echo "  → $name  (CC0 Platformer Kit; $url)"
  local tmpdir; tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/kenney.XXXXXX")"
  if curl -fsSL -o "$tmpdir/pack.zip" "$url" && unzip -q -o "$tmpdir/pack.zip" -d "$tmpdir/extract"; then
    rm -rf "$target"; mkdir -p "$target"
    # Flatten if the zip wraps everything in a single top-level directory.
    shopt -s nullglob dotglob
    local top=("$tmpdir/extract"/*)
    if [ "${#top[@]}" -eq 1 ] && [ -d "${top[0]}" ]; then
      mv "${top[0]}"/* "$target"/ 2>/dev/null || true
      mv "${top[0]}"/.[!.]* "$target"/ 2>/dev/null || true
    else
      mv "$tmpdir/extract"/* "$target"/ 2>/dev/null || true
    fi
    shopt -u nullglob dotglob
    echo "  ✓ $name — extracted"
    ok=$((ok + 1))
  else
    echo "  ⏭  $name — download/unzip failed (optional; playground GLBs are vendored, skipping)" >&2
  fi
  rm -rf "$tmpdir"
}

mode_label="depth-1"; [ "${#DEPTH_ARGS[@]}" -eq 0 ] && mode_label="full (with history)"
echo "Reconstructing $REF_DIR"
echo "Cloning pinned reference engines over HTTPS [$mode_label]:"
for spec in "${REPOS[@]}"; do
  IFS='|' read -r name url sha ref <<<"$spec"
  clone_pinned "$name" "$url" "$sha" "$ref" || true
done
restore_kenney || true

echo
echo "Done — $ok cloned, $skipped skipped, $failed failed."
[ "$failed" -eq 0 ]
