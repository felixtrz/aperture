# Stop Conditions

An autonomous agent must stop and update `agent/HANDOFF.md` instead of continuing if any of these occur:

1. The current minute of the hour is `:50` or later.
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

The stop hook does not treat `lastResult=stop-condition` as a bypass for the
minute-50 gate. If ready tasks remain and the current minute is before `:50`,
the hook blocks final stopping even when a stop condition was documented.

No ready task remaining is not a final stop condition by itself, but the agent must never generate `plan-X`, `audit-X`, or `tracker-alignment-X` tasks to fill the window. If `agent/BACKLOG.md` has no ready visible-feature task, read the current examples and public API, compare against `docs/NORTH_STAR.md` and `docs/MEDIUM_LONG_TERM_GOALS.md`, and write one visible-feature task per `agent/WAKE.md` §9. If after 5 minutes of inspection no visible-feature slice can be identified, stop and document the gap in handoff. Stopping early with real work shipped is better than filling time with ceremony.

Completing a single task before the minute-50 stop gate opens is not a stop
condition. If no stop condition applies and ready work remains, the agent should
select the next ready task and continue.

A validation failure is not, by itself, permission to stop before the minute-50
gate opens. If validation fails before minute `:50`, keep working on a focused
fix or select the ready task that addresses the failure. Stop only if the same
failure repeats after a focused fix attempt, the cause requires an unsafe/broad
decision, or the minute-50 gate is open.

When stopping:

- Explain the blocker.
- Preserve useful partial work only if coherent.
- Update handoff.
- Recommend a next action.
