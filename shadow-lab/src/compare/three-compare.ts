// Split-screen shadow PARITY harness: aperture (left) vs a reference three.js
// r184 WebGPU renderer (right), driving an IDENTICAL scene (same geometry,
// camera, sun direction, ACES tonemap). The right pane toggles to a per-pixel
// diff heatmap so we can SEE exactly where aperture's shadow diverges from the
// reference — black = identical, red→yellow = increasing difference.
//
// Why this exists: the auto-shadow ortho/bias work needs a ground truth. Eyeball
// "looks shadowy" is not parity; this is. The three.js scene below mirrors
// src/systems/setup.system.ts one-for-one (truck GLB, ground box, sun position,
// ambient). Keep the two in sync when either changes.
//
// Aperture renders in its own loop on #aperture; this module owns a second
// WebGPU canvas (#sl-three) and a shared camera. The aperture camera is driven
// from here via the devtools runtime so both panes always frame the same pose
// (the worker orbit-controls system is disabled while this harness runs).
import * as THREE from "./three.webgpu.js";
import { GLTFLoader } from "./loaders/GLTFLoader.js";
import { quatLookAt, type Vec3 } from "../lib/math.js";

interface DevtoolsResponse {
  readonly ok: boolean;
  readonly result?: unknown;
}
interface McpRuntime {
  callTool(tool: string, payload?: unknown): Promise<DevtoolsResponse>;
}

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
    await new Promise((r) => setTimeout(r, 100));
  }
}

// ---- shared orbit state (mirrors orbit-controls.system.ts defaults) ----
const orbit = { azimuth: 0.8, elevation: 1.15, distance: 4 };
const POLE = Math.PI / 2 - 0.01;
const target: Vec3 = [0, 0.5, 0];
const TRUCK_URL = "/models/vehicle-truck-green.glb";
const TRUCK_SCALE = 0.5;
const TRUCK_TRANSLATION: Vec3 = [0, -0.01, 0];
const TRUCK_YAW_RADIANS = Math.PI;

function orbitEye(): Vec3 {
  const cosEl = Math.cos(orbit.elevation);
  return [
    target[0] + orbit.distance * cosEl * Math.sin(orbit.azimuth),
    target[1] + orbit.distance * Math.sin(orbit.elevation),
    target[2] + orbit.distance * cosEl * Math.cos(orbit.azimuth),
  ];
}

// ---- DOM layout: split the window, add the three pane + diff overlay + bar ----
function layout(): {
  threeCanvas: HTMLCanvasElement;
  diffCanvas: HTMLCanvasElement;
  setLabel: (text: string) => void;
  diffButton: HTMLButtonElement;
} {
  const aperture = document.getElementById("aperture") as HTMLCanvasElement;
  aperture.style.cssText =
    "position:fixed;left:0;top:0;width:50vw;height:100vh;touch-action:none;";

  const threeCanvas = document.createElement("canvas");
  threeCanvas.id = "sl-three";
  threeCanvas.style.cssText =
    "position:fixed;right:0;top:0;width:50vw;height:100vh;touch-action:none;";
  document.body.append(threeCanvas);

  const diffCanvas = document.createElement("canvas");
  diffCanvas.id = "sl-diff";
  diffCanvas.style.cssText =
    "position:fixed;right:0;top:0;width:50vw;height:100vh;display:none;" +
    "image-rendering:pixelated;pointer-events:none;background:#000;";
  document.body.append(diffCanvas);

  // center divider
  const divider = document.createElement("div");
  divider.style.cssText =
    "position:fixed;left:50vw;top:0;width:1px;height:100vh;" +
    "background:rgba(255,255,255,.35);z-index:1000;pointer-events:none;";
  document.body.append(divider);

  // pane labels
  const mkLabel = (text: string, side: "left" | "right"): HTMLDivElement => {
    const d = document.createElement("div");
    d.textContent = text;
    d.style.cssText =
      `position:fixed;top:10px;${side === "left" ? "left:288px" : "right:12px"};` +
      "z-index:1000;font:600 11px ui-monospace,Menlo,monospace;color:#cdd6e0;" +
      "background:rgba(18,22,28,.7);padding:3px 8px;border-radius:6px;" +
      "letter-spacing:.5px;pointer-events:none;";
    document.body.append(d);
    return d;
  };
  mkLabel("◀ APERTURE (WebGPU)", "left");
  const rightLabel = mkLabel("THREE.js r184 (WebGPU) ▶", "right");

  // control bar (bottom center)
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:1000;" +
    "display:flex;gap:8px;align-items:center;font:12px ui-monospace,Menlo,monospace;" +
    "color:#e7ecf2;background:rgba(18,22,28,.86);padding:7px 10px;border-radius:9px;" +
    "border:1px solid rgba(255,255,255,.12);box-shadow:0 8px 30px rgba(0,0,0,.45);";
  const diffButton = document.createElement("button");
  diffButton.textContent = "Diff heatmap: OFF";
  diffButton.style.cssText =
    "cursor:pointer;font:inherit;color:#e7ecf2;background:rgba(255,255,255,.08);" +
    "border:1px solid rgba(255,255,255,.16);border-radius:6px;padding:5px 10px;";
  bar.append(diffButton);
  document.body.append(bar);
  // keep bar/button clicks out of the engine's window input forwarding
  for (const t of ["pointerdown", "wheel", "keydown"]) {
    bar.addEventListener(t, (e) => e.stopPropagation());
  }

  return {
    threeCanvas,
    diffCanvas,
    setLabel: (text) => (rightLabel.textContent = text),
    diffButton,
  };
}

// ---- build the reference scene (1:1 with setup.system.ts) ----
async function buildScene(): Promise<{
  scene: typeof THREE.Scene.prototype;
  truckRoot: typeof THREE.Group.prototype;
}> {
  const scene = new THREE.Scene();
  // Racing background (scene.background = 0xadb2ba, sRGB hex).
  scene.background = new THREE.Color(0xadb2ba);

  const linear = (r: number, g: number, b: number): typeof THREE.Color.prototype =>
    new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

  // Ground: box scaled [40,1,40] at y=-0.5 → top surface at y=0.
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(40, 1, 40),
    new THREE.MeshStandardMaterial({
      color: linear(0.45, 0.7, 0.45),
      roughness: 1,
      metalness: 0,
    }),
  );
  ground.position.set(0, -0.5, 0);
  ground.receiveShadow = true;
  ground.castShadow = false;
  scene.add(ground);

  const truckRoot = await loadTruckReference();
  scene.add(truckRoot);

  // Sun: directional, position [11.4,15,-5.3] → target origin (matches DIR_LIGHT).
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(11.4, 15, -5.3);
  sun.target.position.set(0, 0, 0);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -8;
  sc.right = 8;
  sc.top = 8;
  sc.bottom = -8;
  sc.near = 0.5;
  sc.far = 60;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // Ambient fill: sky-biased hemisphere approximation (matches setup.system.ts:
  // sky 0xc8d8e8 * 0.85 + ground 0x7a8a5a * 0.15, intensity 0.25).
  const skyBias = 0.85;
  const sky = [0xc8 / 255, 0xd8 / 255, 0xe8 / 255];
  const grd = [0x7a / 255, 0x8a / 255, 0x5a / 255];
  const amb = new THREE.AmbientLight(
    new THREE.Color(
      sky[0] * skyBias + grd[0] * (1 - skyBias),
      sky[1] * skyBias + grd[1] * (1 - skyBias),
      sky[2] * skyBias + grd[2] * (1 - skyBias),
    ),
    0.25,
  );
  scene.add(amb);

  return { scene, truckRoot };
}

async function loadTruckReference(): Promise<typeof THREE.Group.prototype> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(TRUCK_URL);
  const truckRoot = gltf.scene as typeof THREE.Group.prototype;
  truckRoot.name = "truck";
  truckRoot.position.set(
    TRUCK_TRANSLATION[0],
    TRUCK_TRANSLATION[1],
    TRUCK_TRANSLATION[2],
  );
  truckRoot.scale.set(TRUCK_SCALE, TRUCK_SCALE, TRUCK_SCALE);
  truckRoot.rotation.y = TRUCK_YAW_RADIANS;
  truckRoot.traverse((object: unknown) => {
    const mesh = object as {
      isMesh?: boolean;
      castShadow?: boolean;
      receiveShadow?: boolean;
    };
    if (mesh.isMesh === true) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return truckRoot;
}

// ---- per-pixel diff heatmap (aperture canvas vs three canvas) ----
function makeDiffer(
  apertureCanvas: HTMLCanvasElement,
  threeCanvas: HTMLCanvasElement,
  diffCanvas: HTMLCanvasElement,
): () => void {
  // Diff at a capped resolution for speed; CSS scales the result up.
  const W = 480;
  const H = 640;
  diffCanvas.width = W;
  diffCanvas.height = H;
  const a = document.createElement("canvas");
  a.width = W;
  a.height = H;
  const b = document.createElement("canvas");
  b.width = W;
  b.height = H;
  const ga = a.getContext("2d", { willReadFrequently: true })!;
  const gb = b.getContext("2d", { willReadFrequently: true })!;
  const gd = diffCanvas.getContext("2d")!;
  const out = gd.createImageData(W, H);

  return () => {
    try {
      ga.drawImage(apertureCanvas, 0, 0, W, H);
      gb.drawImage(threeCanvas, 0, 0, W, H);
    } catch {
      return;
    }
    const pa = ga.getImageData(0, 0, W, H).data;
    const pb = gb.getImageData(0, 0, W, H).data;
    const o = out.data;
    for (let i = 0; i < pa.length; i += 4) {
      const d = Math.max(
        Math.abs(pa[i] - pb[i]),
        Math.abs(pa[i + 1] - pb[i + 1]),
        Math.abs(pa[i + 2] - pb[i + 2]),
      );
      // black (match) → red → yellow (large diff)
      o[i] = Math.min(255, d * 4);
      o[i + 1] = Math.min(255, Math.max(0, d * 4 - 255));
      o[i + 2] = 0;
      o[i + 3] = 255;
    }
    gd.putImageData(out, 0, 0);
  };
}

export async function installThreeCompare(): Promise<void> {
  const rt = await waitForRuntime();
  if (!rt) {
    // eslint-disable-next-line no-console
    console.warn("[three-compare] devtools runtime unavailable; skipping.");
    return;
  }

  const { threeCanvas, diffCanvas, setLabel, diffButton } = layout();
  setLabel("THREE.js loading truck...");
  let sceneBundle:
    | {
        scene: typeof THREE.Scene.prototype;
        truckRoot: typeof THREE.Group.prototype;
      }
    | null = null;
  try {
    sceneBundle = await buildScene();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[three-compare] truck GLB load failed:", err);
    setLabel("THREE.js truck load FAILED — see console");
    return;
  }
  const { scene, truckRoot } = sceneBundle;
  setLabel("THREE.js r184 (WebGPU) ▶");

  const renderer = new THREE.WebGPURenderer({
    canvas: threeCanvas,
    antialias: true,
  });
  renderer.setClearColor(0xadb2ba, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  try {
    await renderer.init();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[three-compare] WebGPU renderer init failed:", err);
    setLabel("THREE.js init FAILED — see console");
    return;
  }

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

  const sizePixels = (): { w: number; h: number; dpr: number } => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return { w: Math.floor(window.innerWidth / 2), h: window.innerHeight, dpr };
  };
  const resize = (): void => {
    const { w, h, dpr } = sizePixels();
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  // ---- own the camera: find aperture's camera + truck entities, disable the
  // worker orbit-controls (done in the system file), push pose from here. ----
  interface EntityRef {
    readonly index: number;
    readonly generation: number;
  }
  const find = async (name: string): Promise<EntityRef | null> => {
    const res = await rt.callTool("ecs_find_entities", { query: { limit: 200 } });
    const summaries =
      (res.result as { summaries?: { name: string | null; entity: EntityRef }[] })
        ?.summaries ?? [];
    return summaries.find((s) => s.name === name)?.entity ?? null;
  };
  let truckRef = await find("truck");

  let cameraPushInFlight = false;
  let cameraPushQueued = false;
  const pushApertureCamera = (eye: Vec3 = orbitEye()): void => {
    if (cameraPushInFlight) {
      cameraPushQueued = true;
      return;
    }

    cameraPushInFlight = true;
    cameraPushQueued = false;
    void rt
      .callTool("camera_set_transform", {
        key: "camera.main",
        translation: eye,
        rotation: quatLookAt(eye, target),
      })
      .finally(() => {
        cameraPushInFlight = false;
        if (cameraPushQueued) {
          pushApertureCamera();
        }
      });
  };
  const applyCameraPose = (): void => {
    const eye = orbitEye();
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.lookAt(target[0], target[1], target[2]);
    pushApertureCamera(eye);
  };
  applyCameraPose();

  // Mirror aperture's truck transform onto the three group. The debug panel can
  // move/rotate/scale the aperture truck; poll so the reference truck follows.
  const pollTruck = async (): Promise<void> => {
    if (!truckRef) truckRef = await find("truck");
    if (!truckRef) return;
    const res = await rt.callTool("ecs_get_entity", { entity: truckRef });
    const localTransform = (
      res.result as {
        summary?: {
          localTransform?: {
            translation?: number[];
            rotation?: number[];
            scale?: number[];
          } | null;
        };
      }
    )?.summary?.localTransform;
    const t = localTransform?.translation;
    if (t) {
      truckRoot.position.set(
        t[0] ?? TRUCK_TRANSLATION[0],
        t[1] ?? TRUCK_TRANSLATION[1],
        t[2] ?? TRUCK_TRANSLATION[2],
      );
    }
    const r = localTransform?.rotation;
    if (r) {
      truckRoot.quaternion.set(r[0] ?? 0, r[1] ?? 0, r[2] ?? 0, r[3] ?? 1);
    }
    const s = localTransform?.scale;
    if (s) {
      truckRoot.scale.set(
        s[0] ?? TRUCK_SCALE,
        s[1] ?? TRUCK_SCALE,
        s[2] ?? TRUCK_SCALE,
      );
    }
  };
  void pollTruck();
  setInterval(() => void pollTruck(), 200);

  // ---- camera orbit (drag + wheel), drives BOTH renderers ----
  let prev: [number, number] | null = null;
  const onDown = (e: PointerEvent): void => {
    if ((e.target as HTMLElement)?.closest?.("#sl-panel")) return;
    prev = [e.clientX, e.clientY];
  };
  const onMove = (e: PointerEvent): void => {
    if (!prev) return;
    const dx = (e.clientX - prev[0]) / window.innerWidth;
    const dy = (e.clientY - prev[1]) / window.innerHeight;
    orbit.azimuth -= dx * 3.0;
    orbit.elevation = Math.max(-POLE, Math.min(POLE, orbit.elevation - dy * 3.0));
    prev = [e.clientX, e.clientY];
    applyCameraPose();
  };
  const onUp = (): void => {
    prev = null;
  };
  const onWheel = (e: WheelEvent): void => {
    if ((e.target as HTMLElement)?.closest?.("#sl-panel")) return;
    orbit.distance = Math.max(2, Math.min(120, orbit.distance + e.deltaY * 0.02));
    applyCameraPose();
  };
  window.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("wheel", onWheel, { passive: true });

  // ---- diff toggle ----
  const differ = makeDiffer(
    document.getElementById("aperture") as HTMLCanvasElement,
    threeCanvas,
    diffCanvas,
  );
  let diffOn = false;
  diffButton.addEventListener("click", () => {
    diffOn = !diffOn;
    diffButton.textContent = `Diff heatmap: ${diffOn ? "ON" : "OFF"}`;
    diffButton.style.background = diffOn
      ? "rgba(59,125,221,.9)"
      : "rgba(255,255,255,.08)";
    diffCanvas.style.display = diffOn ? "block" : "none";
  });

  // ---- render loop ----
  const loop = async (): Promise<void> => {
    try {
      renderer.render(scene, camera);
    } catch {
      /* transient device hiccup; next frame retries */
    }
    if (diffOn) differ();
    requestAnimationFrame(() => void loop());
  };
  void loop();
}
