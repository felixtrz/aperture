import { installApertureAppPhysics, } from "./physics-facade.js";
export function createAperturePhysicsFeature(options) {
    let facade = null;
    return {
        id: "physics",
        async installRuntime(context) {
            facade = await installApertureAppPhysics({
                world: context.world,
                assets: context.assets,
                physics: options.physics,
                config: options.config,
                registerFixedStepTask: context.registerFixedStepTask,
            });
            return () => {
                facade?.dispose();
                facade = null;
            };
        },
        getFacade() {
            return facade;
        },
    };
}
//# sourceMappingURL=physics-feature.js.map