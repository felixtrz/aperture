// In-house ear-clipping polygon triangulation (Earcut-style) — no third-party
// dependency. `triangulateShape` triangulates a simple outer contour with any
// number of holes and returns triangles as index triples into the concatenated
// `[...contour, ...holes[0], ...holes[1], ...]` point list, mirroring three.js
// `ShapeUtils.triangulateShape`. The algorithm is a doubly-linked-list ear
// clipper with hole bridging (Eberly / earcut): the outer ring is normalized to
// counter-clockwise, each hole to clockwise and spliced in through a visible
// bridge, then ears are clipped off until three vertices remain. Degenerate or
// collinear ears are skipped; if progress stalls the remaining ring is closed
// with a fan so the routine always terminates and never loses coverage.

export type ShapePoint = readonly [number, number];

interface EarNode {
  /** Index into the flat concatenated coordinate list. */
  readonly i: number;
  readonly x: number;
  readonly y: number;
  prev: EarNode;
  next: EarNode;
  steiner: boolean;
}

/**
 * Triangulate `contour` (with optional `holes`) into CCW triangles. Each
 * triangle is `[i, j, k]` indices into the concatenated point list
 * `[...contour, ...holes[0], ...]`. Returns an empty list for fewer than three
 * contour points.
 */
export function triangulateShape(
  contour: readonly ShapePoint[],
  holes: readonly (readonly ShapePoint[])[] = [],
): number[][] {
  if (contour.length < 3) {
    return [];
  }

  // Outer ring is normalized to CCW (positive area) so ear orientation tests
  // are consistent regardless of the caller's winding.
  let outerNode = buildRing(contour, 0, true);

  if (outerNode === null) {
    return [];
  }

  let indexOffset = contour.length;
  const holeRings: EarNode[] = [];

  for (const hole of holes) {
    if (hole.length < 3) {
      indexOffset += hole.length;
      continue;
    }

    // Holes are normalized to CW so their bridged edges cut cleanly into the
    // CCW outer ring.
    const holeRing = buildRing(hole, indexOffset, false);

    if (holeRing !== null) {
      holeRings.push(holeRing);
    }

    indexOffset += hole.length;
  }

  if (holeRings.length > 0) {
    outerNode = eliminateHoles(outerNode, holeRings);
  }

  const triangles: number[][] = [];

  earClip(outerNode, triangles);
  return triangles;
}

// Builds a doubly-linked ring from `points`, assigning coordinate indices
// starting at `indexStart`. `wantCcw` forces the traversal order so the ring's
// winding matches the request (CCW for the outer contour, CW for holes).
function buildRing(
  points: readonly ShapePoint[],
  indexStart: number,
  wantCcw: boolean,
): EarNode | null {
  const isCcw = signedArea(points) > 0;
  const forward = isCcw === wantCcw;
  let last: EarNode | null = null;

  if (forward) {
    for (let index = 0; index < points.length; index += 1) {
      last = insertNode(indexStart + index, points[index] as ShapePoint, last);
    }
  } else {
    for (let index = points.length - 1; index >= 0; index -= 1) {
      last = insertNode(indexStart + index, points[index] as ShapePoint, last);
    }
  }

  if (last !== null && nodesEqual(last, last.next)) {
    removeNode(last);
    last = last.next;
  }

  return last;
}

function earClip(start: EarNode, triangles: number[][]): void {
  const filtered = filterPoints(start, null);

  if (filtered === null) {
    return;
  }

  let ear = filtered;
  let stop = ear;

  while (ear.prev !== ear.next) {
    const next = ear.next;

    if (isEar(ear)) {
      triangles.push([ear.prev.i, ear.i, next.i]);
      removeNode(ear);
      ear = next.next;
      stop = next.next;
      continue;
    }

    ear = next;

    // A full lap without clipping an ear means the ring is (near-)degenerate
    // (all-collinear remnant). Close it with a fan so triangulation always
    // terminates and every remaining vertex stays covered.
    if (ear === stop) {
      fanRemaining(filterPoints(ear, null) ?? ear, triangles);
      return;
    }
  }
}

// Fallback fan for a stalled ring (collinear/degenerate vertices): connect the
// anchor to every other vertex. Never produces overlaps for convex remnants and
// guarantees termination + full coverage for the pathological rest.
function fanRemaining(node: EarNode, triangles: number[][]): void {
  const anchor = node;
  let current = anchor.next;

  while (current !== anchor && current.next !== anchor) {
    triangles.push([anchor.i, current.i, current.next.i]);
    current = current.next;
  }
}

function isEar(ear: EarNode): boolean {
  const a = ear.prev;
  const b = ear;
  const c = ear.next;

  // Reflex corner: not an ear.
  if (area(a, b, c) >= 0) {
    return false;
  }

  // No other vertex may lie inside triangle (a, b, c).
  let node = c.next;

  while (node !== a) {
    if (
      pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, node.x, node.y) &&
      area(node.prev, node, node.next) >= 0
    ) {
      return false;
    }

    node = node.next;
  }

  return true;
}

// Removes near-duplicate and collinear vertices, which otherwise stall the ear
// search. Returns the (possibly new) ring entry node.
function filterPoints(start: EarNode, endIn: EarNode | null): EarNode | null {
  let end = endIn ?? start;
  let node = start;
  let again = true;

  while (again || node !== end) {
    again = false;

    if (
      !node.steiner &&
      (nodesEqual(node, node.next) || area(node.prev, node, node.next) === 0)
    ) {
      removeNode(node);
      node = end = node.prev;

      if (node === node.next) {
        return null;
      }

      again = true;
    } else {
      node = node.next;
    }
  }

  return end;
}

function eliminateHoles(
  outerNodeIn: EarNode,
  holeRings: readonly EarNode[],
): EarNode {
  // Process holes left-to-right by their leftmost vertex, exactly as earcut, so
  // each bridge sees the already-merged outer ring.
  const queue = holeRings
    .map((ring) => getLeftmost(ring))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  let outerNode = outerNodeIn;

  for (const leftmost of queue) {
    outerNode = eliminateHole(leftmost, outerNode);
  }

  return outerNode;
}

function eliminateHole(hole: EarNode, outerNode: EarNode): EarNode {
  const bridge = findHoleBridge(hole, outerNode);

  if (bridge === null) {
    return outerNode;
  }

  const bridgeReverse = splitPolygon(bridge, hole);

  // Clean up collinear points introduced by the bridge.
  filterPoints(bridgeReverse, bridgeReverse.next);
  return filterPoints(bridge, bridge.next) ?? bridge;
}

// Ray-cast the hole's leftmost vertex to the right, land on the nearest outer
// edge, then walk to the reflex vertex visible from the hole (earcut's
// findHoleBridge).
function findHoleBridge(hole: EarNode, outerNode: EarNode): EarNode | null {
  let node = outerNode;
  const hx = hole.x;
  const hy = hole.y;
  let qx = -Infinity;
  let bridge: EarNode | null = null;

  do {
    if (hy <= node.y && hy >= node.next.y && node.next.y !== node.y) {
      const x =
        node.x +
        ((hy - node.y) * (node.next.x - node.x)) / (node.next.y - node.y);

      if (x <= hx && x > qx) {
        qx = x;

        if (x === hx) {
          if (hy === node.y) {
            return node;
          }
          if (hy === node.next.y) {
            return node.next;
          }
        }

        bridge = node.x < node.next.x ? node : node.next;
      }
    }

    node = node.next;
  } while (node !== outerNode);

  if (bridge === null) {
    return null;
  }

  if (hx === qx) {
    return bridge;
  }

  // Choose the reflex vertex nearest to the hole among candidates inside the
  // triangle (hole, bridge, ray-hit) to guarantee a non-intersecting bridge.
  const stop = bridge;
  const mx = bridge.x;
  const my = bridge.y;
  let tanMin = Infinity;
  node = bridge;

  do {
    if (
      hx >= node.x &&
      node.x >= mx &&
      hx !== node.x &&
      pointInTriangle(
        hy < my ? hx : qx,
        hy,
        mx,
        my,
        hy < my ? qx : hx,
        hy,
        node.x,
        node.y,
      )
    ) {
      const tan = Math.abs(hy - node.y) / (hx - node.x);

      if (
        locallyInside(node, hole) &&
        (tan < tanMin ||
          (tan === tanMin &&
            (node.x > bridge!.x ||
              (node.x === bridge!.x && sectorContainsReflex(bridge!, node)))))
      ) {
        bridge = node;
        tanMin = tan;
      }
    }

    node = node.next;
  } while (node !== stop);

  return bridge;
}

function sectorContainsReflex(bridge: EarNode, node: EarNode): boolean {
  return (
    area(bridge.prev, bridge, node.prev) < 0 &&
    area(node.next, bridge, bridge.next) < 0
  );
}

// Splices a bridge (two coincident edges) between `a` and `b`, merging their
// rings. Returns the mirror node so both rings stay traversable.
function splitPolygon(a: EarNode, b: EarNode): EarNode {
  const a2 = makeNode(a.i, a.x, a.y);
  const b2 = makeNode(b.i, b.x, b.y);
  const an = a.next;
  const bp = b.prev;

  a.next = b;
  b.prev = a;
  a2.next = an;
  an.prev = a2;
  b2.next = a2;
  a2.prev = b2;
  bp.next = b2;
  b2.prev = bp;

  return b2;
}

function getLeftmost(start: EarNode): EarNode {
  let node = start;
  let leftmost = start;

  do {
    if (node.x < leftmost.x || (node.x === leftmost.x && node.y < leftmost.y)) {
      leftmost = node;
    }

    node = node.next;
  } while (node !== start);

  return leftmost;
}

function locallyInside(a: EarNode, b: EarNode): boolean {
  return area(a.prev, a, a.next) < 0
    ? area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0
    : area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
}

function insertNode(
  i: number,
  point: ShapePoint,
  last: EarNode | null,
): EarNode {
  const node = makeNode(i, point[0], point[1]);

  if (last === null) {
    node.prev = node;
    node.next = node;
  } else {
    node.next = last.next;
    node.prev = last;
    last.next.prev = node;
    last.next = node;
  }

  return node;
}

function makeNode(i: number, x: number, y: number): EarNode {
  const node = {
    i,
    x,
    y,
    prev: null as unknown as EarNode,
    next: null as unknown as EarNode,
    steiner: false,
  };
  node.prev = node;
  node.next = node;
  return node;
}

function removeNode(node: EarNode): void {
  node.next.prev = node.prev;
  node.prev.next = node.next;
}

function nodesEqual(a: EarNode, b: EarNode): boolean {
  return a.x === b.x && a.y === b.y;
}

// Twice the signed area of triangle (p, q, r): negative for CCW (the winding
// this clipper keeps interior triangles in), positive for CW/reflex.
function area(p: EarNode, q: EarNode, r: EarNode): number {
  return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

function signedArea(points: readonly ShapePoint[]): number {
  let sum = 0;

  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[j] as ShapePoint;
    const b = points[i] as ShapePoint;
    sum += (a[0] - b[0]) * (b[1] + a[1]);
  }

  // Positive => counter-clockwise in a +Y-up plane.
  return sum;
}

function pointInTriangle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  px: number,
  py: number,
): boolean {
  return (
    (cx - px) * (ay - py) - (ax - px) * (cy - py) >= 0 &&
    (ax - px) * (by - py) - (bx - px) * (ay - py) >= 0 &&
    (bx - px) * (cy - py) - (cx - px) * (by - py) >= 0
  );
}
