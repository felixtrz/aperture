// Shadow Lab debug panel — a persistent, framework-free overlay that drives the
// engine's in-browser devtools runtime (window.__APERTURE_MCP_RUNTIME__, the same
// callTool() the MCP server uses). It needs no worker handle of its own: the
// generated boot installs the runtime because index.html sets
// __APERTURE_MCP_MANAGED__ = true before the app bootstraps.
//
// What it gives you, live, with no rebuild:
//   • Render readout   — FPS + meshes drawn + last render error (polled).
//   • Playback         — pause / step one frame / resume the simulation.
//   • Transform editor — pick any named entity and scrub its translation/scale;
//                        the change is written straight into the ECS component.
//   • Snapshot         — dump the full entity-lookup snapshot to the console.
import { readGeneratedBrowserAppStatus } from "@aperture-engine/app/browser";

interface EntityRef {
  readonly index: number;
  readonly generation: number;
}

interface DevtoolsResponse {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly diagnostics?: readonly unknown[];
}

interface McpRuntime {
  callTool(tool: string, payload?: unknown): Promise<DevtoolsResponse>;
}

interface EntitySummary {
  readonly name: string | null;
  readonly entity: EntityRef;
  readonly localTransform?: {
    readonly translation?: readonly number[];
    readonly scale?: readonly number[];
  } | null;
  readonly componentIds?: readonly string[];
}

const LOCAL_TRANSFORM = "aperture.transform.local";
const POS_RANGE = 25;
const SCALE_MIN = 0.05;
const SCALE_MAX = 12;

function runtime(): McpRuntime | null {
  return (globalThis as Record<string, unknown>)["__APERTURE_MCP_RUNTIME__"] as
    | McpRuntime
    | null;
}

async function waitForRuntime(timeoutMs = 15_000): Promise<McpRuntime | null> {
  const start = performance.now();
  for (;;) {
    const rt = runtime();
    if (rt) return rt;
    if (performance.now() - start > timeoutMs) return null;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// ---------- tiny DOM helpers ----------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Omit<HTMLElementTagNameMap[K], "style">> & { style?: string } = {},
  children: readonly (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { style, ...rest } = props as { style?: string } & Record<string, unknown>;
  Object.assign(node, rest);
  if (style !== undefined) node.style.cssText = style;
  for (const child of children) {
    node.append(child);
  }
  return node;
}

function injectStyles(): void {
  if (document.getElementById("shadow-lab-panel-styles")) return;
  const style = el("style", { id: "shadow-lab-panel-styles" });
  style.textContent = `
    #sl-panel {
      position: fixed; top: 12px; left: 12px; z-index: 2147483647;
      width: 268px; max-height: calc(100vh - 24px); overflow: auto;
      font: 12px/1.45 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      color: #e7ecf2; background: rgba(18, 22, 28, 0.86);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.12); border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.45); user-select: none;
    }
    #sl-panel.collapsed .sl-body { display: none; }
    #sl-head {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 11px; cursor: pointer;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    #sl-head .sl-dot { width: 8px; height: 8px; border-radius: 50%; background:#5fd07a; box-shadow:0 0 6px #5fd07a; }
    #sl-head .sl-dot.bad { background:#e2554f; box-shadow:0 0 6px #e2554f; }
    #sl-head .sl-title { font-weight: 600; letter-spacing: .2px; }
    #sl-head .sl-fps { margin-left: auto; opacity: .75; font-variant-numeric: tabular-nums; }
    #sl-head .sl-chev { opacity: .55; transition: transform .15s; }
    #sl-panel.collapsed #sl-head .sl-chev { transform: rotate(-90deg); }
    .sl-section { padding: 9px 11px; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .sl-section:last-child { border-bottom: 0; }
    .sl-label { text-transform: uppercase; font-size: 10px; letter-spacing: .8px; opacity: .5; margin-bottom: 7px; }
    .sl-stat { display:flex; justify-content:space-between; }
    .sl-stat span:last-child { font-variant-numeric: tabular-nums; opacity:.9; }
    .sl-err { color:#ff8f88; word-break: break-word; margin-top:4px; display:none; }
    .sl-btnrow { display:flex; gap:6px; }
    .sl-btn {
      flex:1; padding:6px 0; text-align:center; cursor:pointer;
      background: rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12);
      border-radius:6px; color:#e7ecf2; font: inherit;
    }
    .sl-btn:hover { background: rgba(255,255,255,0.14); }
    .sl-btn:active { transform: translateY(1px); }
    .sl-btn.active { background:#3b7ddd; border-color:#5b97f0; }
    .sl-row { display:flex; align-items:center; gap:7px; margin-bottom:6px; }
    .sl-row .sl-ax { width:12px; opacity:.6; }
    .sl-row input[type=range] { flex:1; min-width:0; accent-color:#5b97f0; height:3px; }
    .sl-row input[type=number] {
      width:58px; background: rgba(0,0,0,0.35); color:#e7ecf2;
      border:1px solid rgba(255,255,255,0.14); border-radius:5px; padding:3px 5px;
      font: inherit; text-align:right; font-variant-numeric: tabular-nums;
    }
    .sl-select {
      width:100%; box-sizing:border-box; margin-bottom:8px; padding:5px 6px;
      background: rgba(0,0,0,0.35); color:#e7ecf2; font: inherit;
      border:1px solid rgba(255,255,255,0.14); border-radius:6px;
    }
    .sl-hint { opacity:.45; font-size:10px; margin-top:6px; }
  `;
  document.head.append(style);
}

// ---------- panel ----------

interface AxisControl {
  readonly slider: HTMLInputElement;
  readonly number: HTMLInputElement;
}

function axisRow(
  axis: string,
  min: number,
  max: number,
  step: number,
  onChange: () => void,
): { row: HTMLDivElement; control: AxisControl } {
  const slider = el("input", {
    type: "range",
    min: String(min),
    max: String(max),
    step: String(step),
  });
  const number = el("input", {
    type: "number",
    step: String(step),
  });
  slider.addEventListener("input", () => {
    number.value = slider.value;
    onChange();
  });
  number.addEventListener("input", () => {
    slider.value = number.value;
    onChange();
  });
  const row = el("div", { className: "sl-row" }, [
    el("span", { className: "sl-ax", textContent: axis }),
    slider,
    number,
  ]);
  return { row, control: { slider, number } };
}

function setAxis(control: AxisControl, value: number): void {
  control.slider.value = String(value);
  control.number.value = String(round(value));
}

function readAxis(control: AxisControl): number {
  const value = Number.parseFloat(control.number.value);
  return Number.isFinite(value) ? value : 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export async function installDebugPanel(): Promise<void> {
  if (document.getElementById("sl-panel")) return;
  injectStyles();

  const rt = await waitForRuntime();

  // --- header ---
  const dot = el("span", { className: "sl-dot" });
  const fps = el("span", { className: "sl-fps", textContent: "—" });
  const chev = el("span", { className: "sl-chev", textContent: "▾" });
  const head = el("div", { id: "sl-head" }, [
    dot,
    el("span", { className: "sl-title", textContent: "Shadow Lab" }),
    fps,
    chev,
  ]);

  const body = el("div", { className: "sl-body" });
  const panel = el("div", { id: "sl-panel" }, [head, body]);
  head.addEventListener("click", () => panel.classList.toggle("collapsed"));
  // Keep typing/scrubbing inside the panel from leaking into the engine's
  // window-level keyboard/scroll input forwarding.
  for (const type of ["keydown", "keyup", "wheel", "pointerdown"]) {
    panel.addEventListener(type, (event) => event.stopPropagation());
  }
  document.body.append(panel);

  if (!rt) {
    dot.classList.add("bad");
    body.append(
      el("div", { className: "sl-section" }, [
        el("div", {
          className: "sl-err",
          textContent:
            "Devtools runtime unavailable — is the app running in dev mode?",
          style: "display:block",
        }),
      ]),
    );
    return;
  }

  buildRenderSection(body);
  buildPlaybackSection(body, rt);
  await buildTransformSection(body, rt);
}

interface RenderDiagnostics {
  readonly lastError?: unknown;
  readonly lastFrame?: {
    readonly ok?: boolean;
    readonly frame?: number;
    readonly counts?: {
      readonly meshDraws?: number;
      readonly drawCalls?: number;
    };
  };
}

function buildRenderSection(body: HTMLElement): void {
  const draws = el("span", { textContent: "—" });
  const frameNo = el("span", { textContent: "—" });
  const err = el("div", { className: "sl-err" });
  body.append(
    el("div", { className: "sl-section" }, [
      el("div", { className: "sl-label", textContent: "Render" }),
      el("div", { className: "sl-stat" }, [
        el("span", { textContent: "meshes / draws" }),
        draws,
      ]),
      el("div", { className: "sl-stat" }, [
        el("span", { textContent: "frame" }),
        frameNo,
      ]),
      err,
    ]),
  );

  // FPS via rAF; render counts mirrored onto the status global each frame.
  const dot = document.querySelector<HTMLElement>("#sl-head .sl-dot");
  const fpsEl = document.querySelector<HTMLElement>("#sl-head .sl-fps");
  let frames = 0;
  let last = performance.now();
  const tick = (): void => {
    frames += 1;
    const now = performance.now();
    if (now - last >= 500) {
      const value = Math.round((frames * 1000) / (now - last));
      if (fpsEl) fpsEl.textContent = `${value} fps`;
      frames = 0;
      last = now;

      const status = readGeneratedBrowserAppStatus() as
        | { diagnostics?: RenderDiagnostics }
        | null;
      const diag = status?.diagnostics ?? {};
      const frame = diag.lastFrame;
      const meshes = frame?.counts?.meshDraws;
      const calls = frame?.counts?.drawCalls;
      draws.textContent =
        meshes === undefined ? "—" : `${meshes} / ${calls ?? "—"}`;
      frameNo.textContent = frame?.frame === undefined ? "—" : String(frame.frame);

      const lastError = diag.lastError;
      const ok = frame?.ok !== false && !lastError;
      dot?.classList.toggle("bad", !ok);
      if (lastError) {
        err.style.display = "block";
        err.textContent = String(
          (lastError as { message?: string }).message ?? lastError,
        );
      } else {
        err.style.display = "none";
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function buildPlaybackSection(body: HTMLElement, rt: McpRuntime): void {
  const pause = el("div", { className: "sl-btn", textContent: "❚❚ Pause" });
  const step = el("div", { className: "sl-btn", textContent: "▸| Step" });
  const resume = el("div", { className: "sl-btn", textContent: "▶ Resume" });

  const setPaused = (paused: boolean): void => {
    pause.classList.toggle("active", paused);
    resume.classList.toggle("active", !paused);
  };
  setPaused(false);

  pause.addEventListener("click", async () => {
    await rt.callTool("ecs_pause");
    setPaused(true);
  });
  resume.addEventListener("click", async () => {
    await rt.callTool("ecs_resume");
    setPaused(false);
  });
  step.addEventListener("click", async () => {
    await rt.callTool("ecs_step", { frames: 1 });
    setPaused(true);
  });

  body.append(
    el("div", { className: "sl-section" }, [
      el("div", { className: "sl-label", textContent: "Playback" }),
      el("div", { className: "sl-btnrow" }, [pause, step, resume]),
    ]),
  );
}

async function fetchEntities(rt: McpRuntime): Promise<EntitySummary[]> {
  const res = await rt.callTool("ecs_find_entities", { query: { limit: 100 } });
  const summaries = (res.result as { summaries?: EntitySummary[] } | undefined)
    ?.summaries;
  return (summaries ?? []).filter((s) => s.componentIds?.includes(LOCAL_TRANSFORM) ?? true);
}

async function buildTransformSection(
  body: HTMLElement,
  rt: McpRuntime,
): Promise<void> {
  const select = el("select", { className: "sl-select" });
  const tx = axisRow("X", -POS_RANGE, POS_RANGE, 0.1, () => apply());
  const ty = axisRow("Y", -POS_RANGE, POS_RANGE, 0.1, () => apply());
  const tz = axisRow("Z", -POS_RANGE, POS_RANGE, 0.1, () => apply());
  const sc = axisRow("⬚", SCALE_MIN, SCALE_MAX, 0.05, () => applyScale());

  let current: EntityRef | null = null;

  const apply = (): void => {
    if (!current) return;
    void rt.callTool("ecs_set_component_field", {
      entity: current,
      component: LOCAL_TRANSFORM,
      field: "translation",
      value: [readAxis(tx.control), readAxis(ty.control), readAxis(tz.control)],
    });
  };
  const applyScale = (): void => {
    if (!current) return;
    const s = readAxis(sc.control);
    void rt.callTool("ecs_set_component_field", {
      entity: current,
      component: LOCAL_TRANSFORM,
      field: "scale",
      value: [s, s, s],
    });
  };

  const loadEntity = async (ref: EntityRef): Promise<void> => {
    current = ref;
    const res = await rt.callTool("ecs_get_entity", { entity: ref });
    const lt = (res.result as { summary?: EntitySummary } | undefined)?.summary
      ?.localTransform;
    const t = lt?.translation ?? [0, 0, 0];
    const s = lt?.scale ?? [1, 1, 1];
    setAxis(tx.control, t[0] ?? 0);
    setAxis(ty.control, t[1] ?? 0);
    setAxis(tz.control, t[2] ?? 0);
    setAxis(sc.control, s[0] ?? 1);
  };

  select.addEventListener("change", () => {
    const parts = select.value.split(":");
    void loadEntity({ index: Number(parts[0]), generation: Number(parts[1]) });
  });

  const populate = async (preferName?: string): Promise<void> => {
    const entities = await fetchEntities(rt);
    select.replaceChildren();
    for (const summary of entities) {
      const ref = summary.entity;
      const option = el("option", {
        value: `${ref.index}:${ref.generation}`,
        textContent: `${summary.name ?? "(unnamed)"}  #${ref.index}`,
      });
      select.append(option);
    }
    const want =
      preferName !== undefined
        ? entities.find((s) => s.name === preferName)
        : undefined;
    const chosen = want ?? entities[0];
    if (chosen) {
      select.value = `${chosen.entity.index}:${chosen.entity.generation}`;
      await loadEntity(chosen.entity);
    }
  };

  const quick = (name: string): HTMLDivElement => {
    const btn = el("div", { className: "sl-btn", textContent: name });
    btn.addEventListener("click", () => void populate(name));
    return btn;
  };

  const snapshot = el("div", { className: "sl-btn", textContent: "⤓ Snapshot" });
  snapshot.addEventListener("click", async () => {
    const res = await rt.callTool("ecs_snapshot");
    // eslint-disable-next-line no-console
    console.log("[shadow-lab] ecs snapshot", res.result);
  });
  const refresh = el("div", { className: "sl-btn", textContent: "↻ Refresh" });
  refresh.addEventListener("click", () => void populate());

  body.append(
    el("div", { className: "sl-section" }, [
      el("div", { className: "sl-label", textContent: "Transform" }),
      select,
      el("div", { className: "sl-btnrow", style: "margin-bottom:8px" }, [
        quick("cube"),
        quick("sun"),
        quick("ground"),
      ]),
      tx.row,
      ty.row,
      tz.row,
      sc.row,
      el("div", { className: "sl-btnrow", style: "margin-top:4px" }, [
        snapshot,
        refresh,
      ]),
      el("div", {
        className: "sl-hint",
        textContent: "Scrub to move/scale the selected entity live.",
      }),
    ]),
  );

  await populate("cube");
}
