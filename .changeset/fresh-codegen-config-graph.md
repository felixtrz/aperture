---
"@aperture-engine/vite-plugin": patch
---

Evaluate codegen configs in short-lived workers so repeated generation in one
Node process sees edits to shared factories and nested ESM/CommonJS dependencies,
including recovery after a failed import. Only action/signal kind metadata crosses
the worker boundary; browser/headless/AST fallbacks remain unchanged. This does
not expand Vite's watched dependency set or change the headless runtime loader.

Correlate and validate worker responses so unrelated messages posted by config
dependencies cannot be mistaken for generated type metadata.
