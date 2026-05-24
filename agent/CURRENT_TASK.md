# Current Task

If this file names a task, the next agent should prioritize that task over
selecting a new one from `agent/BACKLOG.md`.

Current task: `task-3158` — add a persistent Playwright render proof harness
for clustered-light routes.

Status: `task-3157` completed clustered-light cache pressure history.

Key findings:

- `examples/clustered-lights.html?enable-cluster-pressure-history=1` now keeps
  a stable multi-view clustered scene alive for a 30-frame rolling window.
- Browser status reports cached-path work, a derived no-cache baseline, avoided
  clustered-buffer writes, avoided cookie-atlas tile updates, and avoided local
  shadow submissions.
- The pressure route keeps clustered lighting and shadow-cookie readback pixels
  stable while showing lower cached work than the no-cache baseline.
- Focused Playwright proof passed with zero relevant WebGPU validation warnings.
- The broad headed `test/e2e/clustered-lights.spec.ts` run still wedged in the
  older all-in-one baseline route, which supports making the persistent
  browser/session proof harness the next slice.

Next step: implement `task-3158`.

Reference anchors for `task-3158`:

- `test/e2e/clustered-lights.spec.ts`.
- `playwright.config.ts`.
- `references/engine/src/scene/renderer/frame-pass-update-clustered.js`.
