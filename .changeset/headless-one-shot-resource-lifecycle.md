---
"@aperture-engine/cli": patch
---

Await system and feature cleanup when a one-shot headless command completes or
fails, preventing feature-owned timers from keeping the CLI alive. Share an
idempotent runner cleanup routine with warm sessions, preserve primary command
errors, and report cleanup-only failures.
