# Stop Conditions

An autonomous agent must stop and update `agent/HANDOFF.md` instead of continuing if any of these occur:

1. Tests fail and the cause is unclear.
2. The task requires a major architecture decision not covered by docs.
3. The repo has unexpected uncommitted changes.
4. The task would require adding a large dependency.
5. The task would require deleting or rewriting large unrelated sections.
6. The task requires secrets, credentials, private accounts, or external access not already configured.
7. The task is ambiguous enough to fork the architecture.
8. The same failure happens twice.
9. The agent cannot complete a coherent vertical slice.
10. The agent detects that another run may still be active.
11. The requested change conflicts with `docs/NORTH_STAR.md` or `docs/ARCHITECTURE.md`.
12. The agent is tempted to create a three.js-style scene graph as the core model.

When stopping:

- Explain the blocker.
- Preserve useful partial work only if coherent.
- Update handoff.
- Recommend a next action.
