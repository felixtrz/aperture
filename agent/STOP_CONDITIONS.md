# Stop Conditions

An autonomous agent must stop and update `agent/HANDOFF.md` instead of continuing if any of these occur:

1. The 55-minute work window has elapsed.
2. The current task requires a major architecture decision not covered by docs.
3. The repo has unexpected uncommitted changes.
4. The task would require adding a large dependency.
5. The task would require deleting or rewriting large unrelated sections.
6. The task requires secrets, credentials, private accounts, or external access not already configured.
7. The task is ambiguous enough to fork the architecture.
8. The same validation failure happens twice after a focused fix attempt.
9. The agent cannot complete a coherent vertical slice.
10. The agent detects that another run may still be active.
11. The requested change conflicts with `docs/NORTH_STAR.md` or `docs/ARCHITECTURE.md`.
12. The agent is tempted to create a three.js-style scene graph as the core model.

No ready task remaining is not a final stop condition by itself. If `agent/BACKLOG.md` has no ready tasks, add concrete next-step tasks by comparing the implementation against `docs/NORTH_STAR.md`, `docs/ROADMAP.md`, and `docs/ARCHITECTURE.md`, then continue if the 55-minute window has not elapsed.

Completing a single task before the 55-minute work window has elapsed is not a stop condition. If no stop condition applies and ready work remains, the agent should select the next ready task and continue.

A validation failure is not, by itself, permission to stop before the 55-minute work window. If validation fails and time remains, keep working on a focused fix or select the ready task that addresses the failure. Stop only if the same failure repeats after a focused fix attempt, the cause requires an unsafe/broad decision, or the 55-minute window has elapsed.

When stopping:

- Explain the blocker.
- Preserve useful partial work only if coherent.
- Update handoff.
- Recommend a next action.
