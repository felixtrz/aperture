# Current Task

No active task is currently checked out.

Status: `task-3182` completed the typed generated browser status reader helper.

Key findings:

- `@aperture-engine/app/browser` now exports
  `APERTURE_GENERATED_STATUS_GLOBAL` and
  `readGeneratedBrowserAppStatus(scope?)`.
- Generated browser bootstrap writes status through the exported global name.
- The developer API panel now uses `readGeneratedBrowserAppStatus()` instead of
  directly reading `globalThis.__APERTURE_GENERATED_APP__`.
- Focused unit coverage proves the helper reads a supplied status scope and
  returns `null` for missing status.
- The developer API Playwright teardown now listens for both `exit` and `close`
  from the Vite child process, which keeps the direct browser validation command
  exiting cleanly.

Recommended next task:

- `task-3183` — add developer API panel snapshot/diff controls backed by the
  worker command/status bridge rather than main-thread ECS access.
