# Current Task

No active task is currently checked out.

Status: SOTA roadmap M1-T10 CLI scaffolder semver dependency output completed
in commit `3bdb211d`.

Key findings:

- The CLI version now comes from `packages/cli/package.json` through a
  dist-relative `createRequire(import.meta.url)` lookup that survives published
  package layout.
- `aperture --version`, the top-level help title, and MCP `serverInfo.version`
  now report the package version instead of `0.0.0`.
- Generated project `package.json` files now use project version `0.1.0`.
- Generated Aperture dependencies default to `^0.1.0` for
  `@aperture-engine/app`, `@aperture-engine/vite-plugin`, and
  `@aperture-engine/cli`.
- `APERTURE_LOCAL=1|true|workspace` still emits `workspace:*` for explicit
  in-repo scaffolding.
- `pnpm run check` passed after the M1-T10 feature slice.

Recommended next task:

- `M1-T11` — add CI and release pipeline gates: PR/push CI should run
  `pnpm run check`, release dry-run should build and pack-check all seven
  publishable packages, and publish-readiness regressions should fail the gate.
