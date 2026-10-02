---
"@aperture-engine/app": patch
"@aperture-engine/cli": patch
---

Dispose the previous headless world before reset, snapshot restore, or MCP replacement creates shared ECS component storage. Keep the previous session available through non-mutating preflight, expose unavailable replacement/failure states, and allow retries only after clean cleanup. A rejected disposer now blocks new app bootstraps until process restart.

Release fully and partially initialized candidate systems and installed features after bootstrap/restore failures without replacing the primary error. Guard overlapping lifecycle requests and retain status/log access and idempotent awaited shutdown.
