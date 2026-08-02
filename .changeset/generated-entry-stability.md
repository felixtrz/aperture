---
"@aperture-engine/vite-plugin": patch
---

Stop the dev-server full-reload loop and make system-graph HMR follow config
imports. Generated outputs (the worker entry and action types) are only
rewritten when their content actually changes, and `.aperture/generated` is
excluded from vite's file watcher, so the plugin's own page-load writes never
fan back into a full reload (the loop: load rewrites the entry, the watcher
reloads the page, the reload rewrites the entry). Genuine system-graph
changes now invalidate the on-disk entry module and announce the full reload
themselves. System glob discovery for HMR uses the import-following config
parser, so apps that declare `systems: [...]` in an imported shared config
(the aperture.shared-config.ts pattern) regenerate and reload when system
files are added or removed instead of requiring a dev-server restart.
