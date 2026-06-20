import {
  AppEntityKey,
  LocalTransform,
  createSystem,
  quatFromEulerYXZ,
  type Entity,
} from "@aperture-engine/app/systems";
import {
  CAMERA_FOV_Y_DEGREES,
  CAMERA_COMPOSITION_RIGHT_OFFSET,
  CAMERA_PITCH,
  CAMERA_START_YAW,
  CAMERA_ZOOM,
  CITY_COMPOSITION_BOUNDS,
  cameraOffset,
  cameraRightOffset,
} from "../lib/city-layout.js";
import {
  HERO_DESKTOP_CARD_WIDTH_PX,
  HERO_DESKTOP_CITY_PANEL_GAP_PX,
  HERO_DESKTOP_CITY_TARGET_WIDTH_PX,
  HERO_LAYOUT_COMMAND_CHANNEL,
  type HeroLayoutCommand,
} from "../lib/hero-layout.js";

const DEFAULT_DESKTOP_VIEWPORT_WIDTH_PX = 1920;
const DEFAULT_DESKTOP_VIEWPORT_HEIGHT_PX = 1080;
const DEFAULT_DESKTOP_CARD_LEFT_PX =
  (DEFAULT_DESKTOP_VIEWPORT_WIDTH_PX -
    (HERO_DESKTOP_CITY_TARGET_WIDTH_PX +
      HERO_DESKTOP_CITY_PANEL_GAP_PX +
      HERO_DESKTOP_CARD_WIDTH_PX)) /
    2 +
  HERO_DESKTOP_CITY_TARGET_WIDTH_PX +
  HERO_DESKTOP_CITY_PANEL_GAP_PX;
const MIN_CAMERA_ZOOM = 4;
const MAX_CAMERA_ZOOM = 80;
const MIN_CAMERA_RIGHT_OFFSET = -24;
const MAX_CAMERA_RIGHT_OFFSET = 24;
const CAMERA_SOLVE_ITERATIONS = 18;
const MOBILE_CAMERA_ZOOM = CAMERA_ZOOM * 1.16;
const MOBILE_CAMERA_FOCUS_Y_OFFSET = -0.35;

type Vec3 = readonly [number, number, number];

interface CameraCompositionLayout {
  readonly compact: boolean;
  readonly mobile: boolean;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly stageWidth: number;
  readonly cardLeft: number;
  readonly cardWidth: number;
  readonly cityTargetWidth: number;
  readonly cityPanelGap: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (length <= 0) {
    return [0, 0, 0];
  }
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cityCompositionCorners(): readonly Vec3[] {
  const { min, max } = CITY_COMPOSITION_BOUNDS;
  return [
    [min[0], min[1], min[2]],
    [min[0], min[1], max[2]],
    [min[0], max[1], min[2]],
    [min[0], max[1], max[2]],
    [max[0], min[1], min[2]],
    [max[0], min[1], max[2]],
    [max[0], max[1], min[2]],
    [max[0], max[1], max[2]],
  ];
}

const CITY_COMPOSITION_CORNERS = cityCompositionCorners();

interface ProjectedBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

// Keeps the scene composition aligned with the responsive HTML card. Desktop
// projects the city bounds into screen space, then solves camera zoom and
// lateral pan so the city width and city-to-card gap stay fixed in pixels.
// Compact bottom-card layouts keep the original centered camera.
export default class CameraCompositionSystem extends createSystem({
  priority: 2,
  queries: { keyed: { required: [AppEntityKey, LocalTransform] } },
}) {
  #layout: CameraCompositionLayout = {
    compact: false,
    mobile: false,
    viewportWidth: DEFAULT_DESKTOP_VIEWPORT_WIDTH_PX,
    viewportHeight: DEFAULT_DESKTOP_VIEWPORT_HEIGHT_PX,
    stageWidth: DEFAULT_DESKTOP_VIEWPORT_WIDTH_PX,
    cardLeft: DEFAULT_DESKTOP_CARD_LEFT_PX,
    cardWidth: HERO_DESKTOP_CARD_WIDTH_PX,
    cityTargetWidth: HERO_DESKTOP_CITY_TARGET_WIDTH_PX,
    cityPanelGap: HERO_DESKTOP_CITY_PANEL_GAP_PX,
  };
  #dirty = true;

  override update(): void {
    for (const command of this.commands.drain<HeroLayoutCommand>(
      HERO_LAYOUT_COMMAND_CHANNEL,
    )) {
      if (command.kind === "set-compact") {
        if (this.#layout.compact !== command.compact) {
          this.#layout = { ...this.#layout, compact: command.compact };
          this.#dirty = true;
        }
        continue;
      }

      const nextLayout = {
        compact: command.compact,
        mobile: command.mobile,
        viewportWidth: Math.max(1, finiteOr(command.viewportWidth, 1)),
        viewportHeight: Math.max(1, finiteOr(command.viewportHeight, 1)),
        stageWidth: Math.max(1, finiteOr(command.stageWidth, 1)),
        cardLeft: finiteOr(command.cardLeft, this.#layout.cardLeft),
        cardWidth: Math.max(
          1,
          finiteOr(command.cardWidth, this.#layout.cardWidth),
        ),
        cityTargetWidth: Math.max(
          1,
          finiteOr(command.cityTargetWidth, this.#layout.cityTargetWidth),
        ),
        cityPanelGap: finiteOr(command.cityPanelGap, this.#layout.cityPanelGap),
      };
      if (
        this.#layout.compact !== nextLayout.compact ||
        this.#layout.mobile !== nextLayout.mobile ||
        this.#layout.viewportWidth !== nextLayout.viewportWidth ||
        this.#layout.viewportHeight !== nextLayout.viewportHeight ||
        this.#layout.stageWidth !== nextLayout.stageWidth ||
        this.#layout.cardLeft !== nextLayout.cardLeft ||
        this.#layout.cardWidth !== nextLayout.cardWidth ||
        this.#layout.cityTargetWidth !== nextLayout.cityTargetWidth ||
        this.#layout.cityPanelGap !== nextLayout.cityPanelGap
      ) {
        this.#layout = nextLayout;
        this.#dirty = true;
      }
    }

    if (this.#dirty) {
      this.#dirty = !this.#writeCamera();
    }
  }

  #writeCamera(): boolean {
    const camera = this.#findByKey("camera.main");
    if (camera === null) {
      return false;
    }

    const zoom = this.#layout.mobile
      ? MOBILE_CAMERA_ZOOM
      : this.#layout.compact
        ? CAMERA_ZOOM
        : this.#solveZoom();
    const rightOffset = this.#layout.compact ? 0 : this.#solveRightOffset(zoom);
    const focus = cameraRightOffset(CAMERA_START_YAW, rightOffset);
    const focusY = this.#layout.mobile ? MOBILE_CAMERA_FOCUS_Y_OFFSET : 0;
    const rigOffset = cameraOffset(CAMERA_START_YAW, zoom);

    camera
      .getVectorView(LocalTransform, "translation")
      .set([
        focus[0] + rigOffset[0],
        focus[1] + focusY + rigOffset[1],
        focus[2] + rigOffset[2],
      ]);
    camera
      .getVectorView(LocalTransform, "rotation")
      .set(quatFromEulerYXZ(-CAMERA_PITCH, CAMERA_START_YAW, 0));

    return true;
  }

  #solveZoom(): number {
    const targetWidth = clamp(
      this.#layout.cityTargetWidth,
      1,
      this.#layout.viewportWidth,
    );
    let low = MIN_CAMERA_ZOOM;
    let high = MAX_CAMERA_ZOOM;

    for (let i = 0; i < CAMERA_SOLVE_ITERATIONS; i += 1) {
      const mid = (low + high) / 2;
      const width = this.#projectCityBounds(
        mid,
        CAMERA_COMPOSITION_RIGHT_OFFSET,
      ).width;
      if (width > targetWidth) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return (low + high) / 2;
  }

  #solveRightOffset(zoom: number): number {
    const targetRight = this.#layout.cardLeft - this.#layout.cityPanelGap;
    let low = MIN_CAMERA_RIGHT_OFFSET;
    let high = MAX_CAMERA_RIGHT_OFFSET;
    const lowRight = this.#projectCityBounds(zoom, low).right;
    const highRight = this.#projectCityBounds(zoom, high).right;
    const increasing = highRight > lowRight;

    if (
      (!increasing && targetRight >= lowRight) ||
      (increasing && targetRight <= lowRight)
    ) {
      return low;
    }
    if (
      (!increasing && targetRight <= highRight) ||
      (increasing && targetRight >= highRight)
    ) {
      return high;
    }

    for (let i = 0; i < CAMERA_SOLVE_ITERATIONS; i += 1) {
      const mid = (low + high) / 2;
      const right = this.#projectCityBounds(zoom, mid).right;
      if (right < targetRight === increasing) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return (low + high) / 2;
  }

  #projectCityBounds(zoom: number, rightOffset: number): ProjectedBounds {
    const focus = cameraRightOffset(CAMERA_START_YAW, rightOffset);
    const rigOffset = cameraOffset(CAMERA_START_YAW, zoom);
    const cameraPosition: Vec3 = [
      focus[0] + rigOffset[0],
      focus[1] + rigOffset[1],
      focus[2] + rigOffset[2],
    ];
    const right = normalize(cameraRightOffset(CAMERA_START_YAW, 1));
    const forward = normalize([-rigOffset[0], -rigOffset[1], -rigOffset[2]]);
    const up = normalize(cross(right, forward));
    const aspect = this.#layout.viewportWidth / this.#layout.viewportHeight;
    const tanY = Math.tan((CAMERA_FOV_Y_DEGREES * Math.PI) / 360);

    let left = Number.POSITIVE_INFINITY;
    let rightPx = Number.NEGATIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;

    for (const corner of CITY_COMPOSITION_CORNERS) {
      const delta = subtract(corner, cameraPosition);
      const depth = dot(delta, forward);
      if (depth <= 0) {
        continue;
      }

      const cameraX = dot(delta, right);
      const cameraY = dot(delta, up);
      const ndcX = cameraX / (depth * tanY * aspect);
      const ndcY = cameraY / (depth * tanY);
      const screenX = (0.5 + ndcX * 0.5) * this.#layout.viewportWidth;
      const screenY = (0.5 - ndcY * 0.5) * this.#layout.viewportHeight;
      left = Math.min(left, screenX);
      rightPx = Math.max(rightPx, screenX);
      top = Math.min(top, screenY);
      bottom = Math.max(bottom, screenY);
    }

    if (!Number.isFinite(left) || !Number.isFinite(rightPx)) {
      return {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: 0,
        height: 0,
      };
    }

    return {
      left,
      right: rightPx,
      top,
      bottom,
      width: Math.max(0, rightPx - left),
      height: Math.max(0, bottom - top),
    };
  }

  #findByKey(key: string): Entity | null {
    for (const entity of this.queries.keyed.entities) {
      if (entity.getValue(AppEntityKey, "value") === key) {
        return entity;
      }
    }
    return null;
  }
}
