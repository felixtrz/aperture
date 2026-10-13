import type { LayoutEngine, LayoutHandle } from "./engine.js";
import type { LayoutStyle, MeasureFn } from "./types.js";

/** Per-node input handed to {@link UiLayoutTree.reconcile} via the resolver. */
export interface UiLayoutNodeInput<K> {
  readonly style: LayoutStyle;
  /** Ordered child keys. The tree wires Yoga children to match. */
  readonly children: readonly K[];
  /**
   * Optional leaf measure function (text, images). Applied on first sight and
   * whenever {@link UiLayoutNodeInput.measureKey} changes; pass `null` to clear.
   */
  readonly measure?: MeasureFn | null;
  /**
   * Opaque content token. When it changes, the measure function is re-applied
   * and the node is marked dirty so it re-measures. Bump it whenever the
   * measured content (e.g. text, font size) changes.
   */
  readonly measureKey?: string | number;
  /**
   * When `true`, this node and its subtree are frozen: their style/children are
   * not re-applied and Yoga skips them during `calculate`, preserving the last
   * computed layout. A game-oriented optimization for static UI.
   */
  readonly frozen?: boolean;
}

/** A node's computed layout in absolute (screen) space. */
export interface AbsoluteRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly paddingTop: number;
  readonly paddingRight: number;
  readonly paddingBottom: number;
  readonly paddingLeft: number;
  readonly borderTop: number;
  readonly borderRight: number;
  readonly borderBottom: number;
  readonly borderLeft: number;
}

const ZERO_RECT: AbsoluteRect = {
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  borderTop: 0,
  borderRight: 0,
  borderBottom: 0,
  borderLeft: 0,
};

interface TreeEntry<K> {
  readonly handle: LayoutHandle;
  parent: K | null;
  children: K[];
  /** Whether style/children have been applied at least once (vs. a freshly
   * ensured placeholder). A node can only be frozen-preserved after it has been
   * applied, so a node frozen from creation still gets its initial layout. */
  applied: boolean;
  frozen: boolean;
  measureApplied: boolean;
  measureKey: string | number | undefined;
  abs: AbsoluteRect;
}

/**
 * A retained, keyed flexbox tree backed by a {@link LayoutEngine}. Hosts call
 * {@link UiLayoutTree.reconcile} each frame with the desired tree; nodes are
 * created/updated/pruned incrementally (so Yoga only re-lays-out what changed),
 * frozen subtrees are preserved, then {@link UiLayoutTree.calculate} resolves
 * absolute rects.
 *
 * `K` is a stable node key (e.g. an ECS entity). The tree owns the engine nodes
 * and frees them when keys disappear or {@link UiLayoutTree.dispose} is called.
 */
export class UiLayoutTree<K> {
  private readonly entries = new Map<K, TreeEntry<K>>();
  private readonly visited = new Set<K>();

  constructor(private readonly engine: LayoutEngine) {}

  /** Whether a node currently exists in the tree. */
  has(key: K): boolean {
    return this.entries.has(key);
  }

  /** Number of retained nodes (diagnostic / test aid). */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Reconcile the tree to the desired shape. `roots` are the top-level keys
   * (e.g. UI screens); `resolve` returns the input for any reachable key. Nodes
   * not reached this pass are freed. Frozen subtrees are preserved without being
   * re-resolved.
   */
  reconcile(
    roots: Iterable<K>,
    resolve: (key: K) => UiLayoutNodeInput<K>,
  ): void {
    this.visited.clear();
    for (const root of roots) {
      this.visit(root, null, resolve);
    }
    this.prune();
  }

  private visit(
    key: K,
    parent: K | null,
    resolve: (key: K) => UiLayoutNodeInput<K>,
  ): void {
    const existing = this.entries.get(key);
    const input = resolve(key);

    if (existing !== undefined && existing.applied && input.frozen) {
      // Frozen subtree: preserve everything, just keep it alive.
      existing.parent = parent;
      this.markSubtreeVisited(key);
      return;
    }

    const entry = existing ?? this.create(key);
    entry.parent = parent;
    this.visited.add(key);

    this.engine.setStyle(entry.handle, input.style);
    this.applyMeasure(entry, input);
    this.reconcileChildren(key, entry, input.children);
    entry.frozen = input.frozen ?? false;
    entry.applied = true;

    for (const child of input.children) {
      this.visit(child, key, resolve);
    }
  }

  private create(key: K): TreeEntry<K> {
    const entry: TreeEntry<K> = {
      handle: this.engine.createNode(),
      parent: null,
      children: [],
      applied: false,
      frozen: false,
      measureApplied: false,
      measureKey: undefined,
      abs: ZERO_RECT,
    };
    this.entries.set(key, entry);
    return entry;
  }

  private applyMeasure(entry: TreeEntry<K>, input: UiLayoutNodeInput<K>): void {
    if (input.measure === undefined) {
      return;
    }
    if (entry.measureApplied && entry.measureKey === input.measureKey) {
      return;
    }
    this.engine.setMeasure(entry.handle, input.measure);
    if (input.measure !== null) {
      this.engine.markDirty(entry.handle);
    }
    entry.measureApplied = true;
    entry.measureKey = input.measureKey;
  }

  private reconcileChildren(
    key: K,
    entry: TreeEntry<K>,
    children: readonly K[],
  ): void {
    if (sameOrder(entry.children, children)) {
      // Ensure handles exist even when the order is unchanged (first sight).
      for (const child of children) {
        this.ensure(child);
      }
      return;
    }

    // Detach the current children, then insert the new ordering. Simple and
    // correct; Yoga only dirties on real structural change.
    for (let i = entry.children.length - 1; i >= 0; i -= 1) {
      const child = this.entries.get(entry.children[i]!);
      if (child !== undefined) {
        this.engine.removeChild(entry.handle, child.handle);
        child.parent = null;
      }
    }
    children.forEach((childKey, index) => {
      const child = this.ensure(childKey);
      child.parent = key;
      this.engine.insertChild(entry.handle, child.handle, index);
    });
    entry.children = [...children];
  }

  private ensure(key: K): TreeEntry<K> {
    return this.entries.get(key) ?? this.create(key);
  }

  private markSubtreeVisited(key: K): void {
    if (this.visited.has(key)) {
      return;
    }
    this.visited.add(key);
    const entry = this.entries.get(key);
    if (entry === undefined) {
      return;
    }
    for (const child of entry.children) {
      this.markSubtreeVisited(child);
    }
  }

  private prune(): void {
    const dead: { key: K; entry: TreeEntry<K> }[] = [];
    for (const [key, entry] of this.entries) {
      if (!this.visited.has(key)) {
        dead.push({ key, entry });
      }
    }
    // Detach everything first (handles still alive), then free.
    for (const { entry } of dead) {
      if (entry.parent !== null) {
        const parent = this.entries.get(entry.parent);
        if (parent !== undefined) {
          this.engine.removeChild(parent.handle, entry.handle);
        }
      }
    }
    for (const { key, entry } of dead) {
      this.engine.free(entry.handle);
      this.entries.delete(key);
    }
  }

  /**
   * Compute layout for the tree rooted at `root` within the given available
   * space, then resolve absolute rects for the whole subtree. `originX/Y` place
   * the root's top-left in screen space.
   */
  calculate(
    root: K,
    availableWidth: number | "auto" | undefined,
    availableHeight: number | "auto" | undefined,
    originX = 0,
    originY = 0,
  ): void {
    const entry = this.entries.get(root);
    if (entry === undefined) {
      return;
    }
    this.engine.calculate(entry.handle, availableWidth, availableHeight);
    this.resolveAbsolute(root, originX, originY);
  }

  private resolveAbsolute(key: K, parentLeft: number, parentTop: number): void {
    const entry = this.entries.get(key);
    if (entry === undefined) {
      return;
    }
    const c = this.engine.getComputed(entry.handle);
    const left = parentLeft + c.left;
    const top = parentTop + c.top;
    entry.abs = {
      left,
      top,
      width: c.width,
      height: c.height,
      paddingTop: c.paddingTop,
      paddingRight: c.paddingRight,
      paddingBottom: c.paddingBottom,
      paddingLeft: c.paddingLeft,
      borderTop: c.borderTop,
      borderRight: c.borderRight,
      borderBottom: c.borderBottom,
      borderLeft: c.borderLeft,
    };
    for (const child of entry.children) {
      this.resolveAbsolute(child, left, top);
    }
  }

  /** The last resolved absolute rect for `key` (zero if never calculated). */
  absoluteRect(key: K): AbsoluteRect {
    return this.entries.get(key)?.abs ?? ZERO_RECT;
  }

  /** Whether the node (or a descendant) needs relayout. */
  isDirty(key: K): boolean {
    const entry = this.entries.get(key);
    return entry !== undefined && this.engine.isDirty(entry.handle);
  }

  /** Free every retained node. The engine itself is not disposed. */
  dispose(): void {
    for (const entry of this.entries.values()) {
      this.engine.free(entry.handle);
    }
    this.entries.clear();
    this.visited.clear();
  }
}

function sameOrder<K>(a: readonly K[], b: readonly K[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
