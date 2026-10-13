import type { LayoutEngine } from "./engine.js";
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
export declare class UiLayoutTree<K> {
    private readonly engine;
    private readonly entries;
    private readonly visited;
    constructor(engine: LayoutEngine);
    /** Whether a node currently exists in the tree. */
    has(key: K): boolean;
    /** Number of retained nodes (diagnostic / test aid). */
    get size(): number;
    /**
     * Reconcile the tree to the desired shape. `roots` are the top-level keys
     * (e.g. UI screens); `resolve` returns the input for any reachable key. Nodes
     * not reached this pass are freed. Frozen subtrees are preserved without being
     * re-resolved.
     */
    reconcile(roots: Iterable<K>, resolve: (key: K) => UiLayoutNodeInput<K>): void;
    private visit;
    private create;
    private applyMeasure;
    private reconcileChildren;
    private ensure;
    private markSubtreeVisited;
    private prune;
    /**
     * Compute layout for the tree rooted at `root` within the given available
     * space, then resolve absolute rects for the whole subtree. `originX/Y` place
     * the root's top-left in screen space.
     */
    calculate(root: K, availableWidth: number | "auto" | undefined, availableHeight: number | "auto" | undefined, originX?: number, originY?: number): void;
    private resolveAbsolute;
    /** The last resolved absolute rect for `key` (zero if never calculated). */
    absoluteRect(key: K): AbsoluteRect;
    /** Whether the node (or a descendant) needs relayout. */
    isDirty(key: K): boolean;
    /** Free every retained node. The engine itself is not disposed. */
    dispose(): void;
}
//# sourceMappingURL=tree.d.ts.map