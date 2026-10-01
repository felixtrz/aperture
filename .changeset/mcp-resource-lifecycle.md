---
"@aperture-engine/cli": patch
---

Release connection-owned headless sessions, renderers, and browser client links
when MCP stdio ends or fails. Await asynchronous cleanup, isolate browser caches
between connections, and retry renderer creation after a failed launch while
keeping independently managed dev daemons available across reconnects.
