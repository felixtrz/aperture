# Releasing Aperture

All `@aperture-engine/*` packages publish together in lockstep (a Changesets
`fixed` group). The repo root (`@aperture-engine/workspace`) is `private` and is
never published.

## Prerequisites (one-time)

1. An npm account with publish rights to the `@aperture-engine` scope.
2. A repository secret named `NPM_TOKEN` (an npm **automation** token).
   `.github/workflows/release.yml` wires it via `actions/setup-node`
   (`registry-url` + `always-auth`), so `changeset publish` can authenticate.
3. Publishing happens with npm **provenance** (`id-token: write` +
   `NPM_CONFIG_PROVENANCE`), so it must run from the GitHub Actions workflow, not
   a laptop.

## Cutting the first release (0.1.0)

The first release publishes the current `0.1.0` versions as-is. There are **no
pending changesets** on `main` for the initial cut, so do **not** run
`changeset version` (it would bump every package to `0.1.1`). Just tag:

```bash
# from a clean main at the commit you want to release
git tag v0.1.0
git push origin v0.1.0
```

Pushing a `v*` tag triggers `.github/workflows/release.yml`: it runs the
build + pack dry-run, then `pnpm run release:publish` (`changeset publish`), which
publishes every package at its current `0.1.0` version.

## Subsequent releases (0.1.1+)

1. Add a changeset for each user-facing change: `pnpm run changeset`.
2. When ready to release, bump versions + generate per-package changelogs:
   `pnpm run version-packages` (runs `changeset version`). Commit the result.
3. Tag `vX.Y.Z` and push the tag — the workflow publishes the bumped versions.

## Local verification before tagging

```bash
pnpm run check            # full gate: build, boundaries, publish-readiness, types, lint, tests
pnpm run release:dry-run  # build + `npm pack` every publishable package without publishing
```
