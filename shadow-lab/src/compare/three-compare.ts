// Split-screen static-scene parity harness: Aperture renders the ECS-authored
// racing static scene on the left, and this module renders the same GLB scene
// through three.js r184 WebGPU on the right. One orbit controller drives both
// cameras so shadow/fog/post differences can be inspected side by side.
import {
  quatLookAt,
  type Vec3Tuple as Vec3,
} from "@aperture-engine/simulation";
import * as THREE from "./three.webgpu.js";
import { GLTFLoader } from "./loaders/GLTFLoader.js";
import { bloom } from "./tsl/BloomNode.js";
import {
  BACKGROUND_HEX,
  BLOOM,
  BLOOM_PROBE,
  CAMERA,
  DIR_LIGHT,
  FOG_HEX,
  HEMI_LIGHT,
  SPAWN_POS,
  VEHICLE_ROOT_SCALE,
} from "../lib/tuning.js";
import {
  CELL_RAW,
  GRID_SCALE,
  NPC_TRUCKS,
  ORIENT_DEG,
  TRACK_CELLS,
  computeDecorationBuckets,
  computeTrackBounds,
  decodeCells,
  type DecorationInstance,
  type GridCell,
} from "../lib/track.js";

interface DevtoolsResponse {
  readonly ok: boolean;
  readonly result?: unknown;
}

interface McpRuntime {
  callTool(tool: string, payload?: unknown): Promise<DevtoolsResponse>;
}

type ThreeObject = typeof THREE.Group.prototype;
type ThreeMesh = typeof THREE.Mesh.prototype;

const MODEL_NAMES = [
  "vehicle-truck-yellow",
  "vehicle-truck-green",
  "vehicle-truck-purple",
  "vehicle-truck-red",
  "track-straight",
  "track-corner",
  "track-bump",
  "track-finish",
  "decoration-empty",
  "decoration-forest",
  "decoration-tents",
] as const;

const initialHorizontalDistance = Math.hypot(
  CAMERA.offset[0],
  CAMERA.offset[2],
);
const orbit = {
  azimuth: Math.atan2(CAMERA.offset[0], CAMERA.offset[2]),
  elevation: Math.atan2(CAMERA.offset[1], initialHorizontalDistance),
  distance: Math.hypot(CAMERA.offset[0], CAMERA.offset[1], CAMERA.offset[2]),
};
const POLE = Math.PI / 2 - 0.01;
const target: Vec3 = [SPAWN_POS[0], 0.25, SPAWN_POS[2]];

function runtime(): McpRuntime | null {
  return (globalThis as Record<string, unknown>)[
    "__APERTURE_MCP_RUNTIME__"
  ] as McpRuntime | null;
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

function orbitEye(): Vec3 {
  const cosEl = Math.cos(orbit.elevation);
  return [
    target[0] + orbit.distance * cosEl * Math.sin(orbit.azimuth),
    target[1] + orbit.distance * Math.sin(orbit.elevation),
    target[2] + orbit.distance * cosEl * Math.cos(orbit.azimuth),
  ];
}

function layout(): {
  threeCanvas: HTMLCanvasElement;
  diffCanvas: HTMLCanvasElement;
  setLabel: (text: string) => void;
  diffButton: HTMLButtonElement;
  bloomButton: HTMLButtonElement;
} {
  const aperture = document.getElementById(
    "aperture",
  ) as HTMLCanvasElement | null;
  if (aperture === null) {
    throw new Error("Shadow Lab compare mode requires #aperture canvas.");
  }

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

  const divider = document.createElement("div");
  divider.style.cssText =
    "position:fixed;left:50vw;top:0;width:1px;height:100vh;" +
    "background:rgba(255,255,255,.35);z-index:1000;pointer-events:none;";
  document.body.append(divider);

  const mkLabel = (text: string, side: "left" | "right"): HTMLDivElement => {
    const node = document.createElement("div");
    node.textContent = text;
    node.style.cssText =
      `position:fixed;top:10px;${side === "left" ? "left:12px" : "right:12px"};` +
      "z-index:1000;font:600 11px ui-monospace,Menlo,monospace;color:#cdd6e0;" +
      "background:rgba(18,22,28,.7);padding:3px 8px;border-radius:6px;" +
      "letter-spacing:.5px;pointer-events:none;";
    document.body.append(node);
    return node;
  };
  mkLabel("APERTURE", "left");
  const rightLabel = mkLabel("THREE.js r184", "right");

  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:1000;" +
    "display:flex;gap:8px;align-items:center;font:12px ui-monospace,Menlo,monospace;" +
    "color:#e7ecf2;background:rgba(18,22,28,.86);padding:7px 10px;border-radius:9px;" +
    "border:1px solid rgba(255,255,255,.12);box-shadow:0 8px 30px rgba(0,0,0,.45);";

  const makeButton = (text: string): HTMLButtonElement => {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.cssText =
      "cursor:pointer;font:inherit;color:#e7ecf2;background:rgba(255,255,255,.08);" +
      "border:1px solid rgba(255,255,255,.16);border-radius:6px;padding:5px 10px;";
    return button;
  };
  const bloomButton = makeButton("Bloom: ON");
  const diffButton = makeButton("Diff heatmap: OFF");
  bar.append(bloomButton);
  bar.append(diffButton);
  document.body.append(bar);
  for (const type of ["pointerdown", "wheel", "keydown"]) {
    bar.addEventListener(type, (event) => event.stopPropagation());
  }

  return {
    threeCanvas,
    diffCanvas,
    setLabel: (text) => {
      rightLabel.textContent = text;
    },
    diffButton,
    bloomButton,
  };
}

function resolvePageTrack(): {
  readonly cells: readonly GridCell[];
  readonly customMap: boolean;
} {
  const mapParam = new URLSearchParams(window.location.search).get("map");
  if (mapParam !== null && mapParam.length > 0) {
    try {
      const cells = decodeCells(mapParam);
      if (cells.length > 0) {
        return { cells, customMap: true };
      }
    } catch {
      // Match the reference: bad shared-map links fall back to the default track.
    }
  }
  return { cells: TRACK_CELLS, customMap: false };
}

async function loadModels(): Promise<Map<string, ThreeObject>> {
  const loader = new GLTFLoader();
  const models = new Map<string, ThreeObject>();
  await Promise.all(
    MODEL_NAMES.map(async (name) => {
      const gltf = await loader.loadAsync(`/models/${name}.glb`);
      const root = gltf.scene as ThreeObject;
      root.traverse((object: unknown) => {
        const mesh = object as ThreeMesh & {
          isMesh?: boolean;
          material?: { side?: unknown };
        };
        if (mesh.isMesh === true) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.material !== undefined) {
            mesh.material.side = THREE.FrontSide;
          }
        }
      });
      models.set(name, root);
    }),
  );
  return models;
}

async function buildScene(): Promise<{
  readonly scene: typeof THREE.Scene.prototype;
  readonly playerRoot: ThreeObject | null;
}> {
  const { cells, customMap } = resolvePageTrack();
  const bounds = computeTrackBounds(cells);
  const groundSize = Math.max(bounds.halfWidth, bounds.halfDepth) * 2 + 20;
  const models = await loadModels();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_HEX);
  scene.fog = new THREE.Fog(FOG_HEX, groundSize * 0.4, groundSize * 0.8);

  buildTrack(scene, models, cells, customMap);
  const playerRoot = buildPlayer(scene, models);
  buildBloomProbe(scene);

  const shadowExtent = Math.max(bounds.halfWidth, bounds.halfDepth) + 10;
  const sun = new THREE.DirectionalLight(
    DIR_LIGHT.colorHex,
    DIR_LIGHT.intensity,
  );
  sun.position.set(...DIR_LIGHT.position);
  sun.target.position.set(0, 0, 0);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(DIR_LIGHT.shadowMapSize);
  const shadowCamera = sun.shadow.camera;
  shadowCamera.left = -shadowExtent;
  shadowCamera.right = shadowExtent;
  shadowCamera.top = shadowExtent;
  shadowCamera.bottom = -shadowExtent;
  shadowCamera.near = DIR_LIGHT.shadowNear;
  shadowCamera.far = DIR_LIGHT.shadowFar;
  shadowCamera.updateProjectionMatrix();
  sun.shadow.radius = DIR_LIGHT.shadowRadius;
  scene.add(sun);

  // Aperture currently approximates the reference HemisphereLight as a single
  // sky-biased ambient light. Keep the reference pane on the same fill model so
  // this view isolates render/shadow/post differences instead of light-model drift.
  const skyBias = 0.85;
  const sky = new THREE.Color(HEMI_LIGHT.skyHex);
  const ground = new THREE.Color(HEMI_LIGHT.groundHex);
  const ambient = new THREE.AmbientLight(
    new THREE.Color(
      sky.r * skyBias + ground.r * (1 - skyBias),
      sky.g * skyBias + ground.g * (1 - skyBias),
      sky.b * skyBias + ground.b * (1 - skyBias),
    ),
    HEMI_LIGHT.intensity,
  );
  scene.add(ambient);

  return { scene, playerRoot };
}

function buildTrack(
  scene: typeof THREE.Scene.prototype,
  models: ReadonlyMap<string, ThreeObject>,
  cells: readonly GridCell[],
  customMap: boolean,
): void {
  const trackGroup = new THREE.Group();
  trackGroup.position.y = -0.5;
  trackGroup.scale.setScalar(GRID_SCALE);

  const trackPieceGroup = new THREE.Group();
  for (const cell of cells) {
    const piece = placePiece(models, cell);
    if (piece !== null) {
      trackPieceGroup.add(piece);
    }
  }

  const decoGroup = new THREE.Group();
  const buckets = computeDecorationBuckets(cells, customMap);
  createInstances(
    models.get("decoration-empty") ?? null,
    buckets.empty,
    decoGroup,
  );
  createInstances(
    models.get("decoration-forest") ?? null,
    buckets.forest,
    decoGroup,
  );
  createInstances(
    models.get("decoration-tents") ?? null,
    buckets.tents,
    decoGroup,
  );

  trackGroup.add(trackPieceGroup);
  trackGroup.add(decoGroup);
  scene.add(trackGroup);

  if (!customMap) {
    for (const [key, x, y, z, rotDeg] of NPC_TRUCKS) {
      const src = models.get(key);
      if (src === undefined) continue;
      const npc = cloneObject(src);
      npc.position.set(x, y, z);
      npc.scale.setScalar(VEHICLE_ROOT_SCALE);
      npc.rotation.y = THREE.MathUtils.degToRad(rotDeg + 180);
      setShadowRecursive(npc, true, true);
      scene.add(npc);
    }
  }
}

function placePiece(
  models: ReadonlyMap<string, ThreeObject>,
  cell: GridCell,
): ThreeObject | null {
  const [gx, gz, key, orient] = cell;
  const src = models.get(key);
  if (src === undefined) return null;
  const piece = cloneObject(src);
  piece.position.set((gx + 0.5) * CELL_RAW, 0.5, (gz + 0.5) * CELL_RAW);
  piece.rotation.y = THREE.MathUtils.degToRad(ORIENT_DEG[orient] ?? 0);
  setShadowRecursive(piece, true, true);
  return piece;
}

function createInstances(
  src: ThreeObject | null,
  instances: readonly DecorationInstance[],
  parent: ThreeObject,
): void {
  if (src === null || instances.length === 0) return;
  const dummy = new THREE.Object3D();
  src.traverse((object: unknown) => {
    const mesh = object as ThreeMesh & {
      isMesh?: boolean;
      geometry?: unknown;
      material?: unknown;
    };
    if (mesh.isMesh !== true || mesh.geometry === undefined) return;
    const instanced = new THREE.InstancedMesh(
      mesh.geometry,
      mesh.material,
      instances.length,
    );
    instanced.castShadow = true;
    instanced.receiveShadow = true;
    for (let i = 0; i < instances.length; i += 1) {
      const instance = instances[i]!;
      dummy.position.set(instance.x, 0.5, instance.z);
      dummy.rotation.y = instance.rotQuarters * (Math.PI / 2);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    parent.add(instanced);
  });
}

function buildPlayer(
  scene: typeof THREE.Scene.prototype,
  models: ReadonlyMap<string, ThreeObject>,
): ThreeObject | null {
  const src = models.get("vehicle-truck-yellow");
  if (src === undefined) return null;
  const player = cloneObject(src);
  player.name = "player";
  player.position.set(SPAWN_POS[0], SPAWN_POS[1] - 0.5, SPAWN_POS[2]);
  player.scale.setScalar(VEHICLE_ROOT_SCALE);
  setShadowRecursive(player, true, true);
  scene.add(player);
  return player;
}

function buildBloomProbe(scene: typeof THREE.Scene.prototype): void {
  const material = new THREE.MeshStandardMaterial({
    color: BLOOM_PROBE.baseColorHex,
    emissive: new THREE.Color(
      BLOOM_PROBE.emissiveFactor[0],
      BLOOM_PROBE.emissiveFactor[1],
      BLOOM_PROBE.emissiveFactor[2],
    ),
    emissiveIntensity: 1,
    metalness: 0,
    roughness: BLOOM_PROBE.roughness,
  });
  const probe = new THREE.Mesh(
    new THREE.SphereGeometry(
      BLOOM_PROBE.radius,
      BLOOM_PROBE.segments,
      Math.max(8, Math.floor(BLOOM_PROBE.segments / 2)),
    ),
    material,
  );
  probe.name = "bloom-probe";
  probe.position.set(...BLOOM_PROBE.position);
  probe.castShadow = false;
  probe.receiveShadow = false;
  scene.add(probe);
}

function cloneObject(src: ThreeObject): ThreeObject {
  return src.clone(true) as ThreeObject;
}

function setShadowRecursive(
  object: ThreeObject,
  cast: boolean,
  receive: boolean,
): void {
  object.traverse((child: unknown) => {
    const mesh = child as ThreeMesh & { isMesh?: boolean };
    if (mesh.isMesh === true) {
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
    }
  });
}

function makeDiffer(
  apertureCanvas: HTMLCanvasElement,
  threeCanvas: HTMLCanvasElement,
  diffCanvas: HTMLCanvasElement,
): () => void {
  const width = 480;
  const height = 640;
  diffCanvas.width = width;
  diffCanvas.height = height;
  const apertureCopy = document.createElement("canvas");
  apertureCopy.width = width;
  apertureCopy.height = height;
  const threeCopy = document.createElement("canvas");
  threeCopy.width = width;
  threeCopy.height = height;
  const apertureContext = apertureCopy.getContext("2d", {
    willReadFrequently: true,
  })!;
  const threeContext = threeCopy.getContext("2d", {
    willReadFrequently: true,
  })!;
  const diffContext = diffCanvas.getContext("2d")!;
  const output = diffContext.createImageData(width, height);

  return () => {
    try {
      apertureContext.drawImage(apertureCanvas, 0, 0, width, height);
      threeContext.drawImage(threeCanvas, 0, 0, width, height);
    } catch {
      return;
    }
    const aperturePixels = apertureContext.getImageData(
      0,
      0,
      width,
      height,
    ).data;
    const threePixels = threeContext.getImageData(0, 0, width, height).data;
    const outputPixels = output.data;
    for (let i = 0; i < aperturePixels.length; i += 4) {
      const delta = Math.max(
        Math.abs((aperturePixels[i] ?? 0) - (threePixels[i] ?? 0)),
        Math.abs((aperturePixels[i + 1] ?? 0) - (threePixels[i + 1] ?? 0)),
        Math.abs((aperturePixels[i + 2] ?? 0) - (threePixels[i + 2] ?? 0)),
      );
      outputPixels[i] = Math.min(255, delta * 4);
      outputPixels[i + 1] = Math.min(255, Math.max(0, delta * 4 - 255));
      outputPixels[i + 2] = 0;
      outputPixels[i + 3] = 255;
    }
    diffContext.putImageData(output, 0, 0);
  };
}

export async function installThreeCompare(): Promise<void> {
  const rt = await waitForRuntime();
  if (rt === null) {
    // eslint-disable-next-line no-console
    console.warn("[three-compare] devtools runtime unavailable; skipping.");
    return;
  }

  const { threeCanvas, diffCanvas, setLabel, diffButton, bloomButton } =
    layout();
  setLabel("THREE.js loading scene...");
  let sceneBundle: Awaited<ReturnType<typeof buildScene>>;
  try {
    sceneBundle = await buildScene();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[three-compare] scene load failed:", err);
    setLabel("THREE.js scene load failed");
    return;
  }
  const { scene, playerRoot } = sceneBundle;
  setLabel("THREE.js r184");

  const renderer = new THREE.WebGPURenderer({
    canvas: threeCanvas,
    antialias: true,
  });
  renderer.setClearColor(BACKGROUND_HEX, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  try {
    await renderer.init();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[three-compare] WebGPU renderer init failed:", err);
    setLabel("THREE.js init failed");
    return;
  }

  const camera = new THREE.PerspectiveCamera(
    CAMERA.fovDeg,
    1,
    CAMERA.near,
    CAMERA.far,
  );
  const resize = (): void => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(window.innerWidth / 2);
    const height = window.innerHeight;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  let bloomPipeline: typeof THREE.RenderPipeline.prototype | null = null;
  try {
    const scenePass = THREE.TSL.pass(scene, camera);
    const scenePassColor = scenePass.getTextureNode("output");
    const bloomPass = bloom(
      scenePassColor,
      BLOOM.strength,
      BLOOM.radius,
      BLOOM.threshold,
    );
    bloomPipeline = new THREE.RenderPipeline(renderer);
    bloomPipeline.outputNode = scenePassColor.add(bloomPass);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[three-compare] bloom pipeline unavailable; rendering direct.",
      err,
    );
  }

  let bloomOn =
    new URLSearchParams(window.location.search).get("bloom") !== "0";
  let bloomToggleInFlight = false;
  const updateBloomButton = (): void => {
    bloomButton.textContent = `Bloom: ${bloomOn ? "ON" : "OFF"}`;
    bloomButton.style.background = bloomOn
      ? "rgba(59,125,221,.9)"
      : "rgba(255,255,255,.08)";
    bloomButton.disabled = bloomToggleInFlight;
    bloomButton.style.opacity = bloomToggleInFlight ? "0.65" : "1";
  };
  const setBloomEnabled = async (enabled: boolean): Promise<void> => {
    if (bloomToggleInFlight) return;
    const previous = bloomOn;
    bloomOn = enabled;
    bloomToggleInFlight = true;
    updateBloomButton();
    const response = await rt.callTool("render_set_post_effect_enabled", {
      effectId: "bloom",
      enabled,
    });
    bloomToggleInFlight = false;
    if (!response.ok) {
      bloomOn = previous;
      // eslint-disable-next-line no-console
      console.warn(
        "[three-compare] failed to toggle Aperture bloom:",
        response,
      );
    }
    updateBloomButton();
  };
  updateBloomButton();
  void setBloomEnabled(bloomOn);

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

  const playerRef = await findEntityByName(rt, "player");
  const pollPlayer = async (): Promise<void> => {
    if (playerRoot === null || playerRef === null) return;
    const res = await rt.callTool("ecs_get_entity", { entity: playerRef });
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
      playerRoot.position.set(
        t[0] ?? SPAWN_POS[0],
        t[1] ?? SPAWN_POS[1] - 0.5,
        t[2] ?? SPAWN_POS[2],
      );
    }
    const r = localTransform?.rotation;
    if (r) {
      playerRoot.quaternion.set(r[0] ?? 0, r[1] ?? 0, r[2] ?? 0, r[3] ?? 1);
    }
    const s = localTransform?.scale;
    if (s) {
      playerRoot.scale.set(
        s[0] ?? VEHICLE_ROOT_SCALE,
        s[1] ?? VEHICLE_ROOT_SCALE,
        s[2] ?? VEHICLE_ROOT_SCALE,
      );
    }
  };
  void pollPlayer();
  setInterval(() => void pollPlayer(), 200);

  let prev: [number, number] | null = null;
  const onDown = (event: PointerEvent): void => {
    if ((event.target as HTMLElement)?.closest?.("#sl-panel")) return;
    prev = [event.clientX, event.clientY];
  };
  const onMove = (event: PointerEvent): void => {
    if (prev === null) return;
    const dx = (event.clientX - prev[0]) / window.innerWidth;
    const dy = (event.clientY - prev[1]) / window.innerHeight;
    orbit.azimuth -= dx * 3.0;
    orbit.elevation = Math.max(
      -POLE,
      Math.min(POLE, orbit.elevation - dy * 3.0),
    );
    prev = [event.clientX, event.clientY];
    applyCameraPose();
  };
  const onUp = (): void => {
    prev = null;
  };
  const onWheel = (event: WheelEvent): void => {
    if ((event.target as HTMLElement)?.closest?.("#sl-panel")) return;
    orbit.distance = Math.max(
      2,
      Math.min(120, orbit.distance + event.deltaY * 0.02),
    );
    applyCameraPose();
  };
  window.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("wheel", onWheel, { passive: true });

  const apertureCanvas = document.getElementById(
    "aperture",
  ) as HTMLCanvasElement;
  const differ = makeDiffer(apertureCanvas, threeCanvas, diffCanvas);
  let diffOn = false;
  diffButton.addEventListener("click", () => {
    diffOn = !diffOn;
    diffButton.textContent = `Diff heatmap: ${diffOn ? "ON" : "OFF"}`;
    diffButton.style.background = diffOn
      ? "rgba(59,125,221,.9)"
      : "rgba(255,255,255,.08)";
    diffCanvas.style.display = diffOn ? "block" : "none";
  });
  bloomButton.addEventListener("click", () => {
    void setBloomEnabled(!bloomOn);
  });

  const loop = (): void => {
    try {
      if (bloomOn && bloomPipeline !== null) {
        bloomPipeline.render();
      } else {
        renderer.render(scene, camera);
      }
    } catch {
      // Transient device hiccup; next frame retries.
    }
    if (diffOn) differ();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function findEntityByName(
  rt: McpRuntime,
  name: string,
): Promise<{ readonly index: number; readonly generation: number } | null> {
  const res = await rt.callTool("ecs_find_entities", { query: { limit: 400 } });
  const summaries =
    (
      res.result as {
        summaries?: {
          readonly name: string | null;
          readonly entity: {
            readonly index: number;
            readonly generation: number;
          };
        }[];
      }
    )?.summaries ?? [];
  return summaries.find((summary) => summary.name === name)?.entity ?? null;
}
