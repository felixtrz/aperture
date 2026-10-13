const ZERO_RECT = {
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
export class UiLayoutTree {
    engine;
    entries = new Map();
    visited = new Set();
    constructor(engine) {
        this.engine = engine;
    }
    /** Whether a node currently exists in the tree. */
    has(key) {
        return this.entries.has(key);
    }
    /** Number of retained nodes (diagnostic / test aid). */
    get size() {
        return this.entries.size;
    }
    /**
     * Reconcile the tree to the desired shape. `roots` are the top-level keys
     * (e.g. UI screens); `resolve` returns the input for any reachable key. Nodes
     * not reached this pass are freed. Frozen subtrees are preserved without being
     * re-resolved.
     */
    reconcile(roots, resolve) {
        this.visited.clear();
        for (const root of roots) {
            this.visit(root, null, resolve);
        }
        this.prune();
    }
    visit(key, parent, resolve) {
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
    create(key) {
        const entry = {
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
    applyMeasure(entry, input) {
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
    reconcileChildren(key, entry, children) {
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
            const child = this.entries.get(entry.children[i]);
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
    ensure(key) {
        return this.entries.get(key) ?? this.create(key);
    }
    markSubtreeVisited(key) {
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
    prune() {
        const dead = [];
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
    calculate(root, availableWidth, availableHeight, originX = 0, originY = 0) {
        const entry = this.entries.get(root);
        if (entry === undefined) {
            return;
        }
        this.engine.calculate(entry.handle, availableWidth, availableHeight);
        this.resolveAbsolute(root, originX, originY);
    }
    resolveAbsolute(key, parentLeft, parentTop) {
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
    absoluteRect(key) {
        return this.entries.get(key)?.abs ?? ZERO_RECT;
    }
    /** Whether the node (or a descendant) needs relayout. */
    isDirty(key) {
        const entry = this.entries.get(key);
        return entry !== undefined && this.engine.isDirty(entry.handle);
    }
    /** Free every retained node. The engine itself is not disposed. */
    dispose() {
        for (const entry of this.entries.values()) {
            this.engine.free(entry.handle);
        }
        this.entries.clear();
        this.visited.clear();
    }
}
function sameOrder(a, b) {
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
//# sourceMappingURL=tree.js.map