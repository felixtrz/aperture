// Physics layout ported from the Kenney Starter Kit (CC0) racing kit — computes
// the static wall colliders (straight/finish side walls + corner arc walls) and
// the ground box, as plain data the setup system spawns as fixed bodies.

import {
  CELL_RAW,
  GRID_SCALE,
  ORIENT_DEG,
  TRACK_CELLS,
  computeTrackBounds,
  type GridCell,
} from "./track.js";
import type {
  QuatTuple as Quat,
  Vec3Tuple as Vec3,
} from "@aperture-engine/simulation";

export interface BoxColliderSpec {
  halfExtents: Vec3;
  position: Vec3;
  quaternion: Quat;
  friction: number;
  restitution: number;
}

const S = GRID_SCALE;
const CELL_HALF = CELL_RAW / 2;
const WALL_HALF_THICK = 0.25;
const WALL_X = 4.75;
const WALL_HALF_H = 1.5;

const wallY = (0.5 + WALL_HALF_H) * S - 0.5;
const hThick = WALL_HALF_THICK * S;
const hHeight = WALL_HALF_H * S;
const hLen = CELL_HALF * S;

const ARC_SPAN = -Math.PI / 2;
const ARC_CENTER_X = -CELL_HALF;
const ARC_CENTER_Z = CELL_HALF;
const OUTER_R = 2 * CELL_HALF - WALL_HALF_THICK;
const OUTER_SEG = 8;
const OUTER_SEG_HALF_LEN = ((OUTER_R * (Math.PI / 2)) / OUTER_SEG / 2) * S;
const INNER_R = WALL_HALF_THICK;
const INNER_SEG = 3;
const INNER_SEG_HALF_LEN = ((INNER_R * (Math.PI / 2)) / INNER_SEG / 2) * S;

const WALL_FRICTION = 0.0;
const WALL_RESTITUTION = 0.1;

export function computeWallColliders(
  cells: readonly GridCell[] = TRACK_CELLS,
): BoxColliderSpec[] {
  const out: BoxColliderSpec[] = [];

  const addArcWall = (
    wcx: number,
    wcz: number,
    arcStart: number,
    radius: number,
    numSeg: number,
    segHalfLen: number,
  ): void => {
    for (let i = 0; i < numSeg; i++) {
      const aMid = arcStart + ((i + 0.5) / numSeg) * ARC_SPAN;
      out.push({
        halfExtents: [hThick, hHeight, segHalfLen],
        position: [
          wcx + radius * Math.cos(aMid) * S,
          wallY,
          wcz + radius * Math.sin(aMid) * S,
        ],
        quaternion: [0, Math.sin(-aMid / 2), 0, Math.cos(-aMid / 2)],
        friction: WALL_FRICTION,
        restitution: WALL_RESTITUTION,
      });
    }
  };

  for (const [gx, gz, key, orient] of cells) {
    if (key === "track-bump") continue;
    const cx = (gx + 0.5) * CELL_RAW * S;
    const cz = (gz + 0.5) * CELL_RAW * S;
    const deg = ORIENT_DEG[orient] ?? 0;
    const rad = (deg * Math.PI) / 180;
    const cr = Math.cos(rad);
    const sr = Math.sin(rad);

    if (key === "track-straight" || key === "track-finish") {
      for (const side of [-1, 1]) {
        const lx = side * WALL_X;
        out.push({
          halfExtents: [hThick, hHeight, hLen],
          position: [cx + lx * cr * S, wallY, cz + -lx * sr * S],
          quaternion: [0, Math.sin(rad / 2), 0, Math.cos(rad / 2)],
          friction: WALL_FRICTION,
          restitution: WALL_RESTITUTION,
        });
      }
    } else if (key === "track-corner") {
      const wcx = cx + (ARC_CENTER_X * cr + ARC_CENTER_Z * sr) * S;
      const wcz = cz + (-ARC_CENTER_X * sr + ARC_CENTER_Z * cr) * S;
      const arcStart = -rad;
      addArcWall(wcx, wcz, arcStart, OUTER_R, OUTER_SEG, OUTER_SEG_HALF_LEN);
      addArcWall(wcx, wcz, arcStart, INNER_R, INNER_SEG, INNER_SEG_HALF_LEN);
    }
  }

  return out;
}

export function computeGroundCollider(
  cells: readonly GridCell[] = TRACK_CELLS,
): BoxColliderSpec {
  const bounds = computeTrackBounds(cells);
  const groundSize = Math.max(bounds.halfWidth, bounds.halfDepth) * 2 + 20;
  const roadHalf = groundSize / 2;
  return {
    halfExtents: [roadHalf, 0.01, roadHalf],
    position: [bounds.centerX, -0.125, bounds.centerZ],
    quaternion: [0, 0, 0, 1],
    friction: 5.0,
    restitution: 0.0,
  };
}
