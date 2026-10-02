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
