# Completed Tasks

Move or summarize completed backlog tasks here.

Format:

## task-id — Title

Completed: YYYY-MM-DD

Summary:

- What changed.
- Important files.
- Validation run.
- Follow-up tasks added.

## task-0001 — Initialize TypeScript package

Completed: 2026-05-15

Summary:

- Added a minimal ESM TypeScript package foundation for Aperture.
- Created `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.test.json`, `src/index.ts`, `test/index.test.ts`, `README.md`, `.gitignore`, and `.prettierignore`.
- Added build, test, lint, format, and format-check scripts.
- Exported placeholder project identity metadata only; no ECS or renderer implementation was started.
- Validation run: `npm install`, `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` all pass.
- Follow-up tasks added: none; backlog already has enough concrete ECS foundation tasks.

## task-0002 — Add repository documentation layout

Completed: 2026-05-15

Summary:

- Verified the required docs and agent files already exist: `AGENTS.md`, `docs/NORTH_STAR.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `agent/BACKLOG.md`, `agent/HANDOFF.md`, and `agent/STATUS.json`.
- Left the existing docs and agent layout intact except for normal end-of-run updates to backlog, completed, handoff, and status files.
- Validation run: covered by the same setup validation from `task-0001`.
- Follow-up tasks added: none.
