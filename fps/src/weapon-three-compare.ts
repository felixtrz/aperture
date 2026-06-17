import {
  FPS_RENDER_BACKGROUND_COLOR,
  SOURCE_WEAPON_CAMERA_ITEM_FOV,
  SOURCE_WEAPON_VIEW_POSITION,
  WEAPONS,
} from "./lib/fps-data.js";

type ThreeModule = typeof import("../../shadow-lab/src/compare/three.webgpu.js");
type GltfLoaderModule = typeof import("../../shadow-lab/src/compare/loaders/GLTFLoader.js");

type ThreeObject = {
  position: { set(x: number, y: number, z: number): void };
  rotation: { set(x: number, y: number, z: number): void };
  scale: { set(x: number, y: number, z: number): void };
  traverse(callback: (object: unknown) => void): void;
};

type ThreeMesh = {
  isMesh?: boolean;
  material?:
    | {
        side?: unknown;
        needsUpdate?: boolean;
      }
    | readonly {
        side?: unknown;
        needsUpdate?: boolean;
      }[];
};

const COMPARE_PARAM = "weapon";
const CENTERED_WEAPON_POSITION = [0, -1.1, -2.75] as const;
type WeaponPositionMode = "source" | "current" | "center";

export function shouldInstallWeaponThreeCompare(): boolean {
  return new URLSearchParams(window.location.search).get("compare") ===
    COMPARE_PARAM;
}

export async function installWeaponThreeCompare(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>("#aperture");
  const shell = document.querySelector<HTMLElement>("#game-shell");

  if (canvas === null || shell === null) {
    return;
  }

  const ui = createLayout(shell);
  ui.setStatus("THREE loading blaster...");
  const [THREE, { GLTFLoader }]: [ThreeModule, GltfLoaderModule] =
    await Promise.all([
      import("../../shadow-lab/src/compare/three.webgpu.js"),
      import("../../shadow-lab/src/compare/loaders/GLTFLoader.js"),
    ]);

  const renderer = new THREE.WebGPURenderer({
    canvas: ui.threeCanvas,
    antialias: true,
  });
  renderer.setClearColor(colorToHex(FPS_RENDER_BACKGROUND_COLOR), 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  try {
    await renderer.init();
  } catch (err) {
    ui.setStatus("THREE WebGPU init failed");
    // eslint-disable-next-line no-console
    console.error("[weapon-compare] three WebGPU init failed:", err);
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colorToHex(FPS_RENDER_BACKGROUND_COLOR));
  scene.add(new THREE.AmbientLight(0xffffff, 1.35));

  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(3, 5, 4);
  scene.add(sun);

  const weapon = WEAPONS[0];
  if (weapon === undefined) {
    ui.setStatus("weapon data missing");
    return;
  }

  let root: ThreeObject;
  try {
    root = (await new GLTFLoader().loadAsync(
      `/models/${weapon.assetId}.glb`,
    )).scene as ThreeObject;
  } catch (err) {
    ui.setStatus("THREE blaster load failed");
    // eslint-disable-next-line no-console
    console.error("[weapon-compare] blaster load failed:", err);
    return;
  }

  const applyWeaponPosition = (mode: WeaponPositionMode): void => {
    const position =
      mode === "current"
        ? weapon.position
        : mode === "center"
          ? CENTERED_WEAPON_POSITION
          : SOURCE_WEAPON_VIEW_POSITION;
    root.position.set(position[0], position[1], position[2]);
    ui.setStatus(`THREE GLB side / ${mode} pos`);
  };
  applyWeaponPosition("source");
  root.rotation.set(
    degreesToRadians(weapon.rotationEulerDegrees[0]),
    degreesToRadians(weapon.rotationEulerDegrees[1]),
    degreesToRadians(weapon.rotationEulerDegrees[2]),
  );
  root.scale.set(weapon.scale[0], weapon.scale[1], weapon.scale[2]);
  scene.add(root);

  const materialSide = createMaterialSideController(THREE, root, ui);
  materialSide.set("glb");
  applyWeaponPosition("source");

  const camera = new THREE.PerspectiveCamera(
    SOURCE_WEAPON_CAMERA_ITEM_FOV,
    1,
    0.05,
    20,
  );
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);

  const resize = (): void => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = ui.threeCanvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  ui.sideSelect.addEventListener("change", () => {
    const value = ui.sideSelect.value;
    if (value === "glb" || value === "front" || value === "back") {
      materialSide.set(value);
    }
  });
  ui.positionSelect.addEventListener("change", () => {
    const value = ui.positionSelect.value;
    if (value === "source" || value === "current" || value === "center") {
      applyWeaponPosition(value);
    }
  });

  const loop = (): void => {
    try {
      renderer.render(scene, camera);
    } catch {
      // Retry next frame; transient WebGPU presentation failures can happen
      // while the managed browser is resizing.
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function createLayout(shell: HTMLElement): {
  readonly threeCanvas: HTMLCanvasElement;
  readonly sideSelect: HTMLSelectElement;
  readonly positionSelect: HTMLSelectElement;
  readonly setStatus: (text: string) => void;
} {
  document.body.classList.add("weapon-three-compare");
  document.body.style.background = "#20242f";
  shell.style.cssText =
    "position:fixed;left:0;top:50%;width:min(50vw, calc(100vh * 16 / 9));" +
    "height:min(100vh, calc(50vw * 9 / 16));transform:translateY(-50%);" +
    "margin:0;max-width:none;max-height:none;overflow:hidden;background:#5c6476;";

  for (const selector of ["#hud", "#crosshair", "#boot-splash"]) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el !== null) {
      el.style.display = "none";
    }
  }

  const threeCanvas = document.createElement("canvas");
  threeCanvas.id = "weapon-three";
  threeCanvas.style.cssText =
    "position:fixed;right:0;top:50%;width:min(50vw, calc(100vh * 16 / 9));" +
    "height:min(100vh, calc(50vw * 9 / 16));transform:translateY(-50%);" +
    "touch-action:none;";
  document.body.append(threeCanvas);

  const label = document.createElement("div");
  label.style.cssText =
    "position:fixed;top:10px;right:12px;z-index:1000;" +
    "font:600 11px ui-monospace,Menlo,monospace;color:#dce6f2;" +
    "background:rgba(18,22,28,.74);padding:4px 8px;border-radius:6px;" +
    "pointer-events:none;";
  document.body.append(label);

  const apertureLabel = document.createElement("div");
  apertureLabel.textContent = "APERTURE LIVE";
  apertureLabel.style.cssText =
    "position:fixed;top:10px;left:12px;z-index:1000;" +
    "font:600 11px ui-monospace,Menlo,monospace;color:#dce6f2;" +
    "background:rgba(18,22,28,.74);padding:4px 8px;border-radius:6px;" +
    "pointer-events:none;";
  document.body.append(apertureLabel);

  const divider = document.createElement("div");
  divider.style.cssText =
    "position:fixed;left:50vw;top:0;width:1px;height:100vh;" +
    "background:rgba(255,255,255,.35);z-index:1000;pointer-events:none;";
  document.body.append(divider);

  const sideSelect = document.createElement("select");
  sideSelect.style.cssText =
    "position:fixed;right:12px;bottom:12px;z-index:1001;" +
    "font:12px ui-monospace,Menlo,monospace;color:#e7ecf2;" +
    "background:rgba(18,22,28,.9);border:1px solid rgba(255,255,255,.18);" +
    "border-radius:6px;padding:5px 8px;";
  sideSelect.innerHTML =
    '<option value="glb">GLB side</option>' +
    '<option value="front">FrontSide</option>' +
    '<option value="back">BackSide</option>';
  document.body.append(sideSelect);

  const positionSelect = document.createElement("select");
  positionSelect.style.cssText =
    "position:fixed;right:12px;bottom:48px;z-index:1001;" +
    "font:12px ui-monospace,Menlo,monospace;color:#e7ecf2;" +
    "background:rgba(18,22,28,.9);border:1px solid rgba(255,255,255,.18);" +
    "border-radius:6px;padding:5px 8px;";
  positionSelect.innerHTML =
    '<option value="source">Source pos</option>' +
    '<option value="current">Current Aperture pos</option>' +
    '<option value="center">Centered pos</option>';
  document.body.append(positionSelect);

  return {
    threeCanvas,
    sideSelect,
    positionSelect,
    setStatus: (text) => {
      label.textContent = text;
    },
  };
}

function createMaterialSideController(
  THREE: ThreeModule,
  root: ThreeObject,
  ui: { readonly setStatus: (text: string) => void },
): { readonly set: (side: "glb" | "front" | "back") => void } {
  const originalSides: unknown[] = [];
  const materials: {
    side?: unknown;
    needsUpdate?: boolean;
  }[] = [];

  root.traverse((object: unknown) => {
    const mesh = object as ThreeMesh;
    if (mesh.isMesh !== true || mesh.material === undefined) {
      return;
    }

    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) {
      materials.push(material);
      originalSides.push(material.side);
    }
  });

  const apply = (side: unknown): void => {
    for (const material of materials) {
      material.side = side;
      material.needsUpdate = true;
    }
  };

  return {
    set(side) {
      if (side === "glb") {
        for (let index = 0; index < materials.length; index += 1) {
          const material = materials[index];
          if (material === undefined) continue;
          material.side = originalSides[index];
          material.needsUpdate = true;
        }
        ui.setStatus("THREE GLB side");
        return;
      }

      apply(side === "front" ? THREE.FrontSide : THREE.BackSide);
      ui.setStatus(`THREE ${side === "front" ? "FrontSide" : "BackSide"}`);
    },
  };
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function colorToHex(color: readonly [number, number, number, number]): number {
  const r = Math.max(0, Math.min(255, Math.round(color[0] * 255)));
  const g = Math.max(0, Math.min(255, Math.round(color[1] * 255)));
  const b = Math.max(0, Math.min(255, Math.round(color[2] * 255)));
  return (r << 16) | (g << 8) | b;
}
