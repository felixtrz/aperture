---
"@aperture-engine/app": minor
"@aperture-engine/cli": minor
---

Expose machine-readable editing affordances in shared agent tooling. Component
schema responses now include writable/read-only fields derived from the
existing mutation allowlist, while preserving field types, enum mappings and
defaults. MCP entity query, selection, mutation and checkpoint tools describe
their supported arguments and nesting. Mutation permissions and validators are
unchanged.
