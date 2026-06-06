# Document Status Convention

Top-level `docs/*PLAN*.md` and `docs/*PROPOSAL*.md` files must include a
`Status:` line near the top of the file. Use one of these leading status values:

- `Status: plan` for active or future-facing plans.
- `Status: ready-for-execution` for source-verified execution queues.
- `Status: implemented` for shipped plans kept as design or acceptance history.
- `Status: superseded` for obsolete plans kept as historical context.

The status line may include extra detail after the leading value. Explicitly
named `docs/research/ACTIVE_*` and `docs/research/SUPERSEDED_*` plan/proposal
files are also checked so active/superseded research artifacts cannot drift.

`pnpm run check:progress` runs the status checker.
