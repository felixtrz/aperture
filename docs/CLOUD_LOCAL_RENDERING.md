# Cloud-local WebGPU rendering

This is the only approved browser-launch route for Aperture browser testing,
development renders and benchmark renders in this dot cloud environment.
It is not a production requirement or a policy for other machines or users.
Existing Playwright/e2e commands are for other environments, not an alternative
launch route here. A render pass is not a claim that the full e2e suite passed.

## Requirements

- Linux with readable browser process information under `/proc` and working CDP
- A previously provisioned runtime directory containing exactly
  `playwright-core@1.60.0` and `@sparticuz/chromium@153.0.0` in `node_modules`
- An existing absolute scratch directory, owned by the established cleanup
  lifecycle wrapper, and a retained output directory outside disposable scratch
- A trusted local scene served at a numeric loopback HTTP origin

These pins describe the separately provisioned rendering runtime, not the
workspace's Playwright dependency. The command validates them and never installs,
downloads, or updates packages. Runtime provisioning remains a separate approved
step. It must not silently use the workspace browser or a newer runtime.

## Invocation

Start the trusted static server using an ephemeral port. Within the established
cleanup lifecycle wrapper, run:

```sh
export APERTURE_WEBGPU_RUNTIME=/absolute/existing/render-runtime
pnpm run render:cloud \
  --url http://127.0.0.1:PORT/ \
  --scratch "$APERTURE_TMP_RUN" \
  --width 1254 --height 1254 \
  --output /absolute/retained-output/result.json \
  --screenshot /absolute/retained-output/render.png
```

Replace the illustrative paths and PORT with actual values. The wrapper must
already provide `APERTURE_TMP_RUN`; this repository does not create or reconfigure
the environment's cleanup policy. `--runtime` overrides
`APERTURE_WEBGPU_RUNTIME`; `--scratch` overrides `APERTURE_TMP_RUN`.
Keep source, bundle inputs, screenshots and final reports outside disposable
scratch. The caller owns server startup and shutdown; use `try/finally`.

For a frozen Aperture render-harness scene add
`--bundle /absolute/frozen-scene.bundle.json`. The runner injects it as
`__APERTURE_RENDER_BUNDLE__` before scripts execute. Without a bundle the page
must be self-contained. The page signals completion by setting
`__APERTURE_RENDER_STATUS__` to `true` or `{ ok: true }`; use
`--ready-global NAME` for another single global name. The default timeout is
120000 ms; override it with `--timeout MILLISECONDS`. This applies separately
to navigation, scene readiness and screenshot capture, not a total job deadline.
CDP verification, page evaluation/GPU completion and context/browser shutdown
remain awaited; a timeout does not establish process termination. If a tool
interrupts a stalled run, treat cleanup as unverified until the wrapper and
processes are reconciled. Do not retry a browser launch merely because a timer
expired.

The CLI defaults to an 800×600 viewport. Use `--width` and `--height` to match
the scene's render target (for example, both 1254 for the frozen courtyard);
the other dimension keeps its default if only one is supplied. Both the CLI and
API require integer dimensions from 1 through 16384, the runner's supported
range. Available host resources may impose lower practical limits. Bundle
dimensions do not override the viewport automatically. Reports record the
actual requested viewport; screenshots capture that viewport and can crop a
larger scene if dimensions do not match.

Programmatic harnesses import `runVerifiedScene` from
`scripts/verified-webgpu.mjs`, passing explicit `runtimeRoot`, `scratchRoot`,
`url`, `outputPath` and optional `bundlePath`, `screenshotPath`, `readyGlobal`,
`timeout`, or `viewport: { width, height }`. The API does not read environment
defaults; those are CLI conveniences. Do not use the lower-level helper as a
standalone launch route: it intentionally has no proof gate.

## What is verified

- Exact launch arguments, including default `--enable-unsafe-webgpu`,
  SwiftShader/Vulkan, `chromiumSandbox: true`, and `ignoreDefaultArgs: true`
- Actual browser executable and argv, using CDP's browser PID and Linux `/proc`
- Native WebGPU calls, a SwiftShader adapter and linked device, a WebGPU canvas,
  actual draw calls and queue submissions, and completed GPU work
- Successful scene readiness and no WebGL attempts, lost devices, uncaptured GPU
  errors, unhandled rejections, page/console errors, or failed HTTP requests
- A repeated proof check after an optional screenshot and successful browser
  cleanup before a report can say `passed`

Only the exact supplied loopback origin is allowed for page HTTP requests.
Other origins are aborted, WebSockets closed, and service workers blocked.
The unchanged proven flags disable background networking and add no sandbox or
site-isolation disabling switches. No flag override or WebGL fallback exists.
A missing adapter, unreadable process proof, unsupported scene, incorrect
runtime version, or configuration drift fails clearly; do not weaken settings.

This is a trusted-scene correctness gate, not a hostile-code or kernel sandbox
attestation or a general network firewall. The instrumentation observes the main
page; iframe/worker GPU rendering needs an explicitly supported verifier
extension. Ordinary simulation workers are not GPU renderers. Uncertain launch
or shutdown preserves the browser profile for reconciliation.
No script or documentation grants permission to bypass tool approvals or
platform safeguards.

## Tests

```sh
pnpm run test:cloud-renderer
```

The dependency-free Node tests cover exact launch configuration, forbidden flag
changes, routing, lifecycle failure paths, proof failures, forwarding
instrumentation, CLI defaults and invalid inputs. They are included in
`pnpm run check`. They do not launch a browser; live rendering requires the
runtime, wrapper and trusted scene described above.

### Successful-frame diagnostics

A successful render (`ok: true`) can still include warnings about omitted
rendering intent. The CLI render status retains those warnings, including shadow
caster `renderId`, mesh identity and omission reason when available. Read
`diagnostics` even on success; warnings alone do not change the frame's `ok` value.
The `aperture render --json` output includes this feedback in
`renderer.diagnostics` and `renderer.shadow`. The optional compact
`shadow.casterCounts` reports requested and included draw
instances across shadow passes, resource-ready draws, encoded draw calls and
actually submitted draw calls. Counts are not unique meshes: cascades and cube
faces can include the same caster more than once, and instancing may combine
several casters into one draw call. A reused shadow map has zero newly submitted
shadow draws while retaining its readiness counts and warnings. Requested counts
include draws considered and filtered by the caster list (including layer or
bounds filtering); unsupported material warnings explain unsupported omissions.

Shadow light-request coverage is separate from caster draw counts. The optional
`shadow.requestCoverage` survives both full reports and compact public/CLI status:
`requestedCount`, `servedCount`, and `omittedCount` describe light requests, with
`requested`, `served`, and `omitted` arrays retaining each `shadowId`, `lightId`,
and normalized `lightKind` (legacy missing kinds mean directional). Each omitted
entry includes a concrete `reason`. Here, **served means routed to the selected
shadow path**, not proof of ready resources, GPU submission, or per-light pixel
occlusion; use the existing readiness, submission and caster fields for those
stages. The legacy `shadow.requestCount` continues to count selected-path requests.

The automatic path supports one non-cascaded shadow-requesting sun plus point
lights in the same frame. A sun plus three points reports four requested, four
served and zero omitted. Adding a shadow-requesting spot reports five requested,
four served and one omitted spot. Cascaded suns or multiple shadow-requesting
suns retain directional precedence and omit their point requests. Other mixed
combinations select directional shadows first, then point, then spot.

Each omission produces a `renderShadowFrame.omittedShadowRequest` warning naming
the request and light with reason `mixed-shadow-kind-not-supported`. Other
unsupported light kinds use `unsupported-shadow-light-kind`. Homogeneous
supported paths and true no-shadow scenes emit no omission warnings. Reused
frames retain coverage and warnings without duplication; changing or removing
requests refreshes them. See [mixed shadows](MIXED_SHADOWS.md) for receiver
ownership, per-kind reports and supported scope.
