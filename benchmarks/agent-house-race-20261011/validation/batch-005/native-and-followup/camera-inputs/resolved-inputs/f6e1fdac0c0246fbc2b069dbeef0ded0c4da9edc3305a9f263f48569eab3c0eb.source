import { recordApertureCleanupFailures } from "./bootstrap-safety.js";
const constructedSystems = new WeakMap();
const systemDisposals = new WeakMap();
const systemDestroyWrappers = new WeakMap();
const appDisposals = new WeakMap();
export function beginApertureSystemBootstrap(world) {
    const registerSystem = world.registerSystem;
    const attempts = [];
    const registerTrackedSystem = function (System, options) {
        // Features may register raw EliCS systems, whose init() runs before the
        // world publishes ownership. Capture construction without changing class
        // identity, metadata, queries, or EliCS registration behavior.
        const TrackedSystem = new Proxy(System, {
            construct(target, args) {
                const attempt = {};
                attempts.push(attempt);
                try {
                    const system = Reflect.construct(target, args, target);
                    trackApertureSystemOwner(world, system);
                    return system;
                }
                catch (error) {
                    if (attempt.owner === undefined) {
                        recordApertureCleanupFailures([
                            new Error(`System '${target.name}' threw during construction before its cleanup owner could be captured.`, { cause: error }),
                        ]);
                    }
                    throw error;
                }
                finally {
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
export function finishApertureSystemBootstrap(world) {
    const bootstrap = constructedSystems.get(world);
    if (bootstrap !== undefined &&
        world.registerSystem === bootstrap.registerTrackedSystem) {
        world.registerSystem = bootstrap.registerSystem;
    }
}
export function trackApertureSystemOwner(world, system) {
    const bootstrap = constructedSystems.get(world);
    bootstrap?.owners.add(system);
    // Feature rollback can unregister a system before outer bootstrap cleanup.
    // EliCS ignores destroy()'s returned promise, so every caller must share the
    // first teardown operation, including owners removed from getSystems().
    if (bootstrap !== undefined)
        trackSystemDisposal(system);
    const attempt = bootstrap?.attempts.at(-1);
    if (attempt !== undefined)
        attempt.owner = system;
}
/** Release complete or partially bootstrapped owners without masking a caller's error. */
export async function disposeApertureAppOwners(world, disposeFeatures) {
    const errors = [];
    const owners = new Set();
    try {
        for (const system of world.getSystems())
            owners.add(system);
    }
    catch (error) {
        errors.push(error);
    }
    for (const system of constructedSystems.get(world)?.owners ?? [])
        owners.add(system);
    for (const system of owners) {
        try {
            trackSystemDisposal(system);
            await system.destroy();
        }
        catch (error) {
            errors.push(error);
        }
    }
    try {
        await disposeFeatures();
    }
    catch (error) {
        errors.push(error);
    }
    finishApertureSystemBootstrap(world);
    constructedSystems.delete(world);
    recordApertureCleanupFailures(errors);
    return errors;
}
/** Idempotent full app cleanup, including systems and runtime features. */
export function disposeApertureApp(app) {
    let pending = appDisposals.get(app);
    if (pending === undefined) {
        pending = Promise.resolve().then(() => disposeApertureAppOwners(app.lowLevel.world, () => app.dispose()));
        appDisposals.set(app, pending);
    }
    return pending;
}
function trackSystemDisposal(system) {
    if (system.destroy === systemDestroyWrappers.get(system))
        return;
    const destroy = system.destroy;
    const dispose = () => {
        const existing = systemDisposals.get(system);
        if (existing !== undefined)
            return existing;
        let resolve;
        let reject;
        const pending = new Promise((done, fail) => {
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
        }
        catch (error) {
            reject(error);
            throw error;
        }
        return pending;
    };
    systemDestroyWrappers.set(system, dispose);
    system.destroy = dispose;
}
//# sourceMappingURL=app-lifecycle.js.map