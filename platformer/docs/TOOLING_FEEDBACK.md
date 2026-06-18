# Tooling feedback: vitexec vs. aperture MCP/CLI

Findings from porting the Kenney 3D platformer onto Aperture while driving the
running app through two different harnesses: the **aperture MCP/CLI**
(`mcp__aperture__*`, `aperture dev`, `aperture tool`) and **vitexec** (run a JS
snippet inside the live Vite page). Captured 2026-06-18.

## TL;DR

Keep both, specialize them. They look like competitors but are different layers:

- **vitexec** = a generic "execute code in the running app and read what you
  want" primitive. Best for scripted interaction, state assertions, input
  simulation, screenshots/video, profiling.
- **MCP/CLI** = a domain API + RAG + session lifecycle. Uniquely owns
  worker/ECS/physics/render introspection, the engine doc corpus, and the
  typed/discoverable surface other agents (Cursor/Codex/Copilot adapters) and CI
  consume.

Make vitexec the daily interactive driver; fix the MCP's two concrete defects;
let the MCP keep the jobs only it can do. The multiplier is **vitexec calling the
MCP runtime bridge from inside the page** (`__APERTURE_MCP_RUNTIME__.callTool(…)`)
— worker introspection *with* vitexec's output control.

## vitexec

### Wins (observed)
- **You control the output.** Logged exactly `y=0.49 grounded=true`. This is the
  single biggest day-to-day win (see the MCP payload problem below).
- **Deterministic scripted sequences.** One snippet = load + act + assert.
  `dispatchApertureInputAction` + `subscribeGeneratedSignals` were clean and
  repeatable where the MCP input was not.
- **The worker/sim DOES boot under headless SwiftShader.** Got real telemetry
  (player rests on the start platform: `grounded=true, y≈0.49`, 400+ signal
  updates over 7 s). The "WebGPU won't run headless" fear did not block the
  *simulation* — only rendering.

### Gaps (today, plain `pnpm dlx vitexec --gpu`)
- **~40 s cold boot per run** (Playwright + Chromium + WebGPU + worker from
  frame 0). The MCP attaches to a running session instantly.
- **State doesn't persist across runs** — every run restarts the sim at frame 0,
  so multi-step exploration must fit in one snippet.
- **No trustworthy frames.** Headless SwiftShader → blank/unreliable WebGPU
  readback, so screenshots are useless. The *headed* MCP session is how the
  black-platform-tops bug was actually seen.
- **Can't reach the worker.** From the page, vitexec only sees what the page
  exposes (signals). It cannot query arbitrary ECS entities, physics colliders,
  or render packets — those live in the sim worker. This is the limitation that
  blocked diagnosing the collision bug.
- Footgun (my mistake): piping vitexec through `| tail` buffers all output until
  EOF and looks like a hang. Redirect to a file instead.

### The fork (`felixtrz/vitexec#feat/adopt-existing-browser`)
Targets the two biggest gaps directly: adopting the already-running **headed**
aperture dev browser gives instant attach, state persistence, **real-GPU frames**,
*and* access to the in-page `__APERTURE_MCP_RUNTIME__` bridge — all on top of
vitexec's output control and input. If it works it becomes the primary tool.

## aperture MCP / CLI

### Uniquely valuable (vitexec can't replicate without becoming the MCP)
- **Worker/ECS/physics/render introspection** (`ecs_find_entities`,
  `render_get_frame_report`, `render_pick_entity`, …).
- **RAG over the engine corpus** (`reference_search` / `reference_api_lookup` /
  `reference_find_examples`).
- **Session lifecycle** (`dev up/down/status/logs`) — which the vitexec fork
  itself depends on.
- **Typed, discoverable surface** for other agents and headless CI.

### Concrete defects found (fixable, not fundamental)
1. **Payload bloat.** Every status/input tool embeds the full diagnostics+render
   snapshot (~100 k chars). `browser_status`, `browser_wait_for_webgpu`,
   `input_key`, `input_reset` each overflowed the agent context and had to be
   `jq`-ed out of a temp file. `render_get_frame_report` already has
   `summaryOnly` — extend that pattern (field selection / `summaryOnly`) to every
   status tool.
2. **`ecs_find_entities` `components` filter is ignored** (returns all entities;
   `key`/`tags` filters work). See `ENGINE_AND_TOOLING_FINDINGS.md` §B1.
   - NOTE: earlier-suspected input defects (`input_action_set` mis-mapping,
     `input_reset` stuck keys) were **retracted** on clean re-test — they were
     stale-snapshot/dirty-state artifacts, not tool bugs. See FINDINGS §C.

### Recommendation (priority order)
1. Add `summaryOnly`/field-selection to every status tool — kill the 100 k
   payloads. (Highest impact.)
2. Make `ecs_find_entities`'s `components` filter actually filter.
3. Keep `__APERTURE_MCP_RUNTIME__` first-class so vitexec can lean on it.

## Division of labor

| Job | Owner |
|---|---|
| Scripted interaction, e2e flows, input sim, screenshots/video, profiling | vitexec (fork) |
| ECS/physics/render introspection, RAG, session lifecycle, typed surface for other agents/CI | MCP/CLI |
| Worker introspection with clean output | vitexec → `__APERTURE_MCP_RUNTIME__.callTool` |
