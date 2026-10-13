const identities = new WeakMap();
let nextIdentity = 1;
/** Logical keys survive buffer/texture recreation; bind groups must not. */
export function gpuResourceIdentity(value) {
    if ((typeof value !== "object" || value === null) &&
        typeof value !== "function") {
        return String(value);
    }
    const object = value;
    let identity = identities.get(object);
    if (identity === undefined) {
        identity = nextIdentity++;
        identities.set(object, identity);
    }
    return String(identity);
}
//# sourceMappingURL=resource-identity.js.map