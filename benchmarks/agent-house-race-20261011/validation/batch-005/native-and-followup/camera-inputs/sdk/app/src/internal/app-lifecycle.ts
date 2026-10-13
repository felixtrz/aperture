import { recordApertureCleanupFailures } from "./bootstrap-safety.js";
import type { EcsWorld } from "@aperture-engine/simulation";

type SystemOwner = { destroy(): unknown };
interface AppOwner {
  readonly lowLevel: { readonly world: EcsWorld };
  dispose(): unknown;
}

// elics publishes a system in getSystems() only after init() returns. Keep
// constructor ownership too, so a throwing initializer cannot orphan cleanup.
interface SystemBootstrap {
  readonly owners: Set<SystemOwner>;
  readonly registerSystem: EcsWorld["registerSystem"];
  readonly registerTrackedSystem: EcsWorld["registerSystem"];
  readonly attempts: { owner?: SystemOwner }[];
}
const constructedSystems = new WeakMap<EcsWorld, SystemBootstrap>();
const systemDisposals = new WeakMap<object, Promise<void>>();
const systemDestroyWrappers = new WeakMap<SystemOwner, () => Promise<void>>();
const appDisposals = new WeakMap<object, Promise<readonly unknown[]>>();

export function beginApertureSystemBootstrap(world: EcsWorld): void {
  const registerSystem = world.registerSystem;
  const attempts: { owner?: SystemOwner }[] = [];
  const registerTrackedSystem: EcsWorld["registerSystem"] = function (
    this: EcsWorld,
    System,
    options,
  ) {
    // Features may register raw EliCS systems, whose init() runs before the
    // world publishes ownership. Capture construction without changing class
    // identity, metadata, queries, or EliCS registration behavior.
    const TrackedSystem = new Proxy(System, {
      construct(target, args) {
        const attempt: { owner?: SystemOwner } = {};
        attempts.push(attempt);
        try {
          const system = Reflect.construct(target, args, target) as SystemOwner;
          trackApertureSystemOwner(world, system);
          return system;
        } catch (error: unknown) {
          if (attempt.owner === undefined) {
            recordApertureCleanupFailures([
              new Error(
                `System '${target.name}' threw during construction before its cleanup owner could be captured.`,
                { cause: error },
              ),
            ]);
          }
          throw error;
        } finally {
          attempts.pop();
        }
      },
    });
    return registerSystem.call(this, TrackedSystem, options);
  };
  constructedSystems.set(world, {
    owners: new Set(),
    registerSystem,
    registerTrackedSystem,
    attempts,
  });
  world.registerSystem = registerTrackedSystem;
}

export function finishApertureSystemBootstrap(world: EcsWorld): void {
  const bootstrap = constructedSystems.get(world);
  if (
    bootstrap !== undefined &&
    world.registerSystem === bootstrap.registerTrackedSystem
  ) {
    world.registerSystem = bootstrap.registerSystem;
  }
}

export function trackApertureSystemOwner(
  world: EcsWorld,
  system: SystemOwner,
): void {
  const bootstrap = constructedSystems.get(world);
  bootstrap?.owners.add(system);
  // Feature rollback can unregister a system before outer bootstrap cleanup.
  // EliCS ignores destroy()'s returned promise, so every caller must share the
  // first teardown operation, including owners removed from getSystems().
  if (bootstrap !== undefined) trackSystemDisposal(system);
  const attempt = bootstrap?.attempts.at(-1);
  if (attempt !== undefined) attempt.owner = system;
}

/** Release complete or partially bootstrapped owners without masking a caller's error. */
export async function disposeApertureAppOwners(
  world: EcsWorld,
  disposeFeatures: () => unknown,
): Promise<readonly unknown[]> {
  const errors: unknown[] = [];
  const owners = new Set<SystemOwner>();
  try {
    for (const system of world.getSystems()) owners.add(system);
  } catch (error: unknown) {
    errors.push(error);
  }
  for (const system of constructedSystems.get(world)?.owners ?? [])
    owners.add(system);
  for (const system of owners) {
    try {
      trackSystemDisposal(system);
      await system.destroy();
    } catch (error: unknown) {
      errors.push(error);
    }
  }
  try {
    await disposeFeatures();
  } catch (error: unknown) {
    errors.push(error);
  }
  finishApertureSystemBootstrap(world);
  constructedSystems.delete(world);
  recordApertureCleanupFailures(errors);
  return errors;
}

/** Idempotent full app cleanup, including systems and runtime features. */
export function disposeApertureApp(app: AppOwner): Promise<readonly unknown[]> {
  let pending = appDisposals.get(app);
  if (pending === undefined) {
    pending = Promise.resolve().then(() =>
      disposeApertureAppOwners(app.lowLevel.world, () => app.dispose()),
    );
    appDisposals.set(app, pending);
  }
  return pending;
}

function trackSystemDisposal(system: SystemOwner): void {
  if (system.destroy === systemDestroyWrappers.get(system)) return;
  const destroy = system.destroy;
  const dispose = (): Promise<void> => {
    const existing = systemDisposals.get(system);
    if (existing !== undefined) return existing;
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const pending = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    systemDisposals.set(system, pending);
    // unregisterSystem ignores async results. Preserve the failure for the
    // app's awaited cleanup without an unhandled-rejection race in between.
    void pending.catch(() => undefined);
    try {
      // Keep synchronous destructor side effects synchronous, while publishing
      // the shared completion promise before user cleanup can reenter.
      Promise.resolve(destroy.call(system)).then(resolve, reject);
    } catch (error: unknown) {
      reject(error);
      throw error;
    }
    return pending;
  };
  systemDestroyWrappers.set(system, dispose);
  system.destroy = dispose;
}
