# Stop Conditions

An autonomous agent must stop and update `agent/HANDOFF.md` instead of continuing if any of these occur:

1. The 45-minute work window has elapsed.
2. No ready task remains in `agent/BACKLOG.md`.
3. The task requires a major architecture decision not covered by docs.
4. The repo has unexpected uncommitted changes.
5. The task would require adding a large dependency.
6. The task would require deleting or rewriting large unrelated sections.
7. The task requires secrets, credentials, private accounts, or external access not already configured.
8. The task is ambiguous enough to fork the architecture.
9. The same validation failure happens twice after a focused fix attempt.
10. The agent cannot complete a coherent vertical slice.
11. The agent detects that another run may still be active.
12. The requested change conflicts with `docs/NORTH_STAR.md` or `docs/ARCHITECTURE.md`.
13. The agent is tempted to create a three.js-style scene graph as the core model.

Completing a single task before the 45-minute work window has elapsed is not a stop condition. If no stop condition applies and ready work remains, the agent should select the next ready task and continue.

A validation failure is not, by itself, permission to stop before the 45-minute work window. If validation fails and time remains, keep working on a focused fix or select the ready task that addresses the failure. Stop only if the same failure repeats after a focused fix attempt, the cause requires an unsafe/broad decision, no ready work remains, or the 45-minute window has elapsed.

When stopping:

- Explain the blocker.
- Preserve useful partial work only if coherent.
- Update handoff.
- Recommend a next action.
