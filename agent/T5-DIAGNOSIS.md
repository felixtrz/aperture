# M3-T5 — root-cause diagnosis + minimal fix (2026-05-31)

UNIQUE_MARKER_T5_DIAGNOSIS_OK

Engine mechanism is DONE and headless-proven (`frame-graph-shadow.test.ts` 7/7,
re-confirmed this session). Branch green: `csm-directional-shadow.spec.ts` = 2
passed on SwiftShader. HEAD = origin = `40a1bca`, clean tree. The ONLY thing
left for T5 is migrating the four hand-rolled shadow examples to hand their
caster passes to the engine so they fold into the single forward encoder.

## Root cause of the reverted csm fold's `ok:false` (commit 6885e15, reverted)

The four shadow examples build their caster pipeline AFTER `renderSnapshot`
(to reuse the forward report's prepared mesh GPU buffers) and feed receiver
resources forward one frame. The reverted fold piped `graphPasses` forward the
same way BUT kept `createRenderShadowFrame` at its default `submit: true`. So in
graph mode each frame:

- the engine's folded depth-only shadow node wrote the (single, persistent)
  shadow depth texture inside the forward encoder, AND
- `createRenderShadowFrame` ALSO separately submitted its own caster command
  buffer writing the SAME texture.

Two writers to the same depth texture across two submissions in one frame →
`rendered.ok === false` on real SwiftShader GPU (resource-state / usage-scope
conflict). Not an engine-mechanism bug.

## Minimal fix (per example, ?graph=1 only)

1. Pass `submit: false` to `aperture.createRenderShadowFrame` so the casters are
   NOT separately submitted — the folded graph node becomes the SOLE writer of
   the depth texture. (With `submit:false` the function still builds an unused
   private encoder/command-buffer that is never submitted = harmless waste; an
   optional engine follow-up is a `mode:"graph"` that skips that encode.)
2. Feed `shadowFrame.graphPasses` (built via `aperture.createShadowCasterGraphPasses`)
   forward one frame: `loop.shadowCasterGraphPasses = shadowFrame.graphPasses`,
   and pass `shadowCasterGraphPasses: loop.shadowCasterGraphPasses` into the next
   `renderSnapshot` call (alongside `useFrameGraph: true`).
3. Keep the legacy path (graph OFF) exactly as-is: `submit` defaults true, no
   graphPasses. The forward route already passes with graph ON (T4 #4); folding
   the casters is the only delta.

Because the folded node is ordered BEFORE the forward node (the forward target
node READS the `shadow:<key>` handles — engine already wired in `frame-boundaries.ts`),
frame N samples freshly-written maps within the same encoder. One command buffer.

NOTE the receiver depth texture is persistent (created once via
`shadowDepthTextureResourceReport ??= ...`), so feed-forward timing of
`receiverResources` is safe — same texture every frame; the folded caster node
just re-renders into it before the forward pass samples it.

## Proofs still owed (Done-when)

- 4 specs (csm/point/spot/multi-light) with `?graph=1`: shadows correct + ONE
  command buffer (`CommandSubmissionMetricsReport.commandBuffers===1`) + zero
  validation warnings.
- vitest: compiler orders shadow nodes < opaque BECAUSE opaque reads the shadow
  handles (remove edge ⇒ reorder) — partially covered by frame-graph-shadow.test.ts.
- vitest/headless: separate shadow `submitCommandBuffers` NOT invoked in graph path.

## Environment blocker (why this wasn't finished here)

Intermittent tool-output corruption recurred mid-session: multi-line `Read`
truncates after ~10-20 lines and returns INCONSISTENT line numbers across calls;
multi-pattern `grep -n` returns false matches; multi-echo Bash truncates after
the first line. RELIABLE channels (verified this session): single-value Bash
(`grep -c`, `git rev-parse`, `git status --porcelain`), vitest summaries, and
E2E `✓`/`N passed` pass-fail signals (timings/line-numbers within them are
cosmetically mangled but the pass/fail is trustworthy). Editing four ~360-line
example files reliably under this is not safe. The corruption cleared at this
session's start and after the prior container restart → resume in a FRESH
session/container. Do NOT mark T5 done until the four specs are proven.
