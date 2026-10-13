// A small, dependency-free seeded PRNG so systems have a sanctioned source of
// randomness that replays bit-identically. Replay determinism holds only when
// systems use `context.random` instead of `Math.random()`.
export function createApertureRandom(seedOrState = 0) {
    // mulberry32
    const seed = typeof seedOrState === "number" ? seedOrState : seedOrState.seed;
    let state = typeof seedOrState === "number" ? seed >>> 0 : seedOrState.state >>> 0;
    function next() {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
        seed,
        snapshot() {
            return { seed, state: state >>> 0 };
        },
        restore(value) {
            state = value.state >>> 0;
        },
        next,
        int(maxExclusive) {
            return Math.floor(next() * Math.max(0, maxExclusive));
        },
        range(min, max) {
            return min + next() * (max - min);
        },
        fork(label) {
            return createApertureRandom(hashSeed(seed, label));
        },
    };
}
export function snapshotApertureRandom(random) {
    return random.snapshot?.() ?? null;
}
export function restoreApertureRandom(random, state) {
    if (random.restore === undefined) {
        return false;
    }
    random.restore(state);
    return true;
}
function hashSeed(seed, label) {
    // FNV-1a over the label, mixed with the parent seed.
    let hash = (seed ^ 0x811c9dc5) >>> 0;
    for (let index = 0; index < label.length; index += 1) {
        hash = Math.imul(hash ^ label.charCodeAt(index), 0x01000193);
    }
    return hash >>> 0;
}
//# sourceMappingURL=random.js.map