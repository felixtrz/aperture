# Current Task

No active task is currently checked out.

Status: SOTA roadmap M1 is complete at 11/11. The final M1 feature slice,
`M1-T11`, landed in commit `f835fb62`.

Key findings:

- `.github/workflows/ci.yml` now runs `pnpm run check` on PRs and pushes to
  `main`.
- `.github/workflows/release.yml` now runs a build + pack dry-run on manual
  dispatch and tags, and publishes only from `refs/tags/v*` with `NPM_TOKEN`.
- `.changeset/config.json` groups the seven publishable `@aperture-engine/*`
  packages for fixed public releases and excludes `playground` from release
  planning; the workspace root is excluded by `pnpm-workspace.yaml`.
- Root scripts now include `check:release-config`, `release:dry-run`,
  `release:publish`, `changeset`, and `version-packages`.
- `pnpm run check` now includes the release-config guard and
  `check:publish`, so CI catches package publishability regressions.
- `scripts/check-release-config.mjs` validates workflow/script/changeset wiring
  and proves a temporary package regression (`private:true` plus `0.0.0`)
  fails the publish-readiness guard.

Recommended next task:

- `M2-T1` — add the headless AnimationClip asset and keyframe sampler core
  with LINEAR, STEP, and CUBICSPLINE coverage.
