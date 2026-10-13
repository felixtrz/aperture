const identities = new WeakMap<object, number>();
let nextIdentity = 1;

/** Logical keys survive buffer/texture recreation; bind groups must not. */
export function gpuResourceIdentity(value: unknown): string {
  if (
    (typeof value !== "object" || value === null) &&
    typeof value !== "function"
  ) {
    return String(value);
  }
  const object = value as object;
  let identity = identities.get(object);
  if (identity === undefined) {
    identity = nextIdentity++;
    identities.set(object, identity);
  }
  return String(identity);
}
