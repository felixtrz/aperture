# Current Task

No active task is currently checked out.

Status: SOTA roadmap M1-T9 package publishability completed in commit
`9962f384`.

Key findings:

- Root and all seven publishable packages now use version `0.1.0` and license
  `MIT`.
- Publishable packages no longer set `private:true`; each declares
  `files: ["dist", "LICENSE"]` and `publishConfig.access: "public"`.
- Each package has a `LICENSE` file so packed tarballs contain license text
  alongside `package.json` and `dist`.
- Inter-package publishable dependencies use `workspace:^`, and
  `scripts/check-package-publish-readiness.mjs --pack` verifies packed package
  manifests do not leak workspace specs.
- `pnpm run publish:dry-run` builds packages and pack-inspects all seven
  publishable tarballs.
- `pnpm run check` passed after the M1-T9 feature slice.

Recommended next task:

- `M1-T10` — make the CLI scaffolder emit installable semver dependency specs
  and a real generated project version instead of `workspace:*` / `0.0.0`.
