---
"@aperture-engine/cli": patch
---

Dispose the warm headless serve session on EOF, shutdown, input failure, and
output exceptions. Drain already queued commands before asynchronous cleanup and
stop reading open input after transport failure.
