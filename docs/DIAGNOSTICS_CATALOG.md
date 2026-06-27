# Diagnostics Catalog

**Status:** generated — do not edit by hand. Regenerate with
`node scripts/generate-diagnostics-catalog.mjs`; CI verifies the committed
file matches the source (`pnpm run check:diagnostics`).

Every structured diagnostic code the engine can emit (1279
codes), grouped by namespace. Agents: when a tool or report returns a
diagnostic, look its code up here for the message contract, whether a
suggestedFix accompanies it, and where it is emitted.

## aperture.asset (1)

| Code                        | Message                       | Fix? | Emitted from                         |
| --------------------------- | ----------------------------- | ---- | ------------------------------------ |
| `aperture.asset.loadFailed` | (message composed at runtime) | yes  | `packages/app/src/systems/assets.ts` |

## aperture.camera (5)

| Code                                          | Message                                                                   | Fix? | Emitted from                                 |
| --------------------------------------------- | ------------------------------------------------------------------------- | ---- | -------------------------------------------- |
| `aperture.camera.notFound`                    | No matching camera entity was found.                                      | yes  | `packages/app/src/worker/devtools/camera.ts` |
| `aperture.camera.savedStateMissing`           | No saved camera state exists in slot '…'.                                 | yes  | `packages/app/src/worker/devtools/camera.ts` |
| `aperture.camera.targetMissingWorldTransform` | The requested camera fit target does not have a WorldTransform component. | yes  | `packages/app/src/worker/devtools/camera.ts` |
| `aperture.camera.targetNotFound`              | The requested camera fit target entity was not found.                     | yes  | `packages/app/src/worker/devtools/camera.ts` |
| `aperture.camera.unsupportedTool`             | Unsupported camera tool '…'.                                              | yes  | `packages/app/src/worker/devtools/camera.ts` |

## aperture.command (1)

| Code                       | Message                                                        | Fix? | Emitted from                           |
| -------------------------- | -------------------------------------------------------------- | ---- | -------------------------------------- |
| `aperture.command.invalid` | Generated Aperture command events require a non-empty channel. | yes  | `packages/app/src/browser/commands.ts` |

## aperture.config (1)

| Code                       | Message                                 | Fix? | Emitted from                                   |
| -------------------------- | --------------------------------------- | ---- | ---------------------------------------------- |
| `aperture.config.notFound` | Aperture config file '…' was not found. | yes  | `packages/vite-plugin/src/system-discovery.ts` |

## aperture.devtools (9)

| Code                                           | Message                                                                                                       | Fix? | Emitted from                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------- |
| `aperture.devtools.componentSchemaNotFound`    | No active component schema was found for '…'.                                                                 | yes  | `packages/app/src/worker/devtools/entities.ts`  |
| `aperture.devtools.invalidPostEffectToggle`    | render_set_post_effect_enabled expects { effectId: string, enabled: boolean }.                                | —    | `packages/app/src/browser/devtools/dispatch.ts` |
| `aperture.devtools.postEffectNotFound`         | No generated WebGPU post effect with id '…' is registered.                                                    | —    | `packages/app/src/browser/devtools/dispatch.ts` |
| `aperture.devtools.runtimeMissing`             | The managed Aperture runtime bridge is not installed in this tab.                                             | —    | `packages/cli/src/tools/runtime.ts`             |
| `aperture.devtools.stepAndDiffMissingSnapshot` | ecs_step_and_diff requires a previous ECS snapshot.                                                           | yes  | `packages/app/src/worker/devtools/bridge.ts`    |
| `aperture.devtools.toolFailed`                 | (message composed at runtime)                                                                                 | yes  | `packages/app/src/worker/devtools/bridge.ts`    |
| `aperture.devtools.unsupportedEntityTool`      | Unsupported generated entity devtools tool '…'.                                                               | yes  | `packages/app/src/worker/devtools/entities.ts`  |
| `aperture.devtools.webgpuFailed`               | The generated WebGPU app failed to initialize; post effects cannot be changed.                                | —    | `packages/app/src/browser/devtools/dispatch.ts` |
| `aperture.devtools.webgpuUnavailable`          | The generated WebGPU app is not available yet; wait for browser_status.webgpuOk before changing post effects. | —    | `packages/app/src/browser/devtools/dispatch.ts` |

## aperture.diagnostic (1)

| Code                          | Message                                  | Fix? | Emitted from                      |
| ----------------------------- | ---------------------------------------- | ---- | --------------------------------- |
| `aperture.diagnostic.unknown` | Aperture reported an unknown diagnostic. | yes  | `packages/app/src/diagnostics.ts` |

## aperture.entityHierarchy (1)

| Code                                   | Message                                                                    | Fix? | Emitted from                                    |
| -------------------------------------- | -------------------------------------------------------------------------- | ---- | ----------------------------------------------- |
| `aperture.entityHierarchy.staleParent` | Entity … references a parent that is not active in the hierarchy snapshot. | yes  | `packages/app/src/entities/lookup/hierarchy.ts` |

## aperture.entityLookup (9)

| Code                                                 | Message                                                                        | Fix? | Emitted from                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------- |
| `aperture.entityLookup.componentFieldUnsupported`    | Field '…' on component '…' is not mutable through the developer entity helper. | yes  | `packages/app/src/entities/lookup/mutation.ts`                                               |
| `aperture.entityLookup.componentMissing`             | Entity … does not have component '…'.                                          | yes  | `packages/app/src/entities/lookup/mutation.ts`                                               |
| `aperture.entityLookup.componentMutationUnsupported` | Component '…' is not mutable through the developer entity helper.              | yes  | `packages/app/src/entities/lookup/mutation.ts`                                               |
| `aperture.entityLookup.duplicateKey`                 | Entity lookup requires a finite integer { index, generation } reference.       | yes  | `packages/app/src/entities/lookup/query.ts`                                                  |
| `aperture.entityLookup.generationMismatch`           | Entity index … is active with generation …, not requested generation ….        | yes  | `packages/app/src/entities/lookup/query.ts`<br>`packages/app/src/entities/lookup/resolve.ts` |
| `aperture.entityLookup.invalidComponentFieldValue`   | Field '…' on component '…' requires ….                                         | yes  | `packages/app/src/entities/lookup/mutation.ts`                                               |
| `aperture.entityLookup.invalidNamePattern`           | Entity namePattern '…' is not a valid regular expression.                      | yes  | `packages/app/src/entities/lookup/query.ts`                                                  |
| `aperture.entityLookup.invalidRef`                   | Entity lookup requires a finite integer { index, generation } reference.       | yes  | `packages/app/src/entities/lookup/query.ts`<br>`packages/app/src/entities/lookup/resolve.ts` |
| `aperture.entityLookup.notFound`                     | No active entity exists at index ….                                            | yes  | `packages/app/src/entities/lookup/query.ts`<br>`packages/app/src/entities/lookup/resolve.ts` |

## aperture.entityTools (3)

| Code                                          | Message                                                                 | Fix? | Emitted from                                   |
| --------------------------------------------- | ----------------------------------------------------------------------- | ---- | ---------------------------------------------- |
| `aperture.entityTools.diffMissingSnapshot`    | Entity diff requires a previous generated entity snapshot.              | yes  | `packages/app/src/worker/devtools/entities.ts` |
| `aperture.entityTools.invalidMutationRequest` | Entity mutation requires component and field string values.             | yes  | `packages/app/src/worker/devtools/entities.ts` |
| `aperture.entityTools.missingEntityRef`       | Entity tool command requires an entity { index, generation } reference. | yes  | `packages/app/src/worker/devtools/entities.ts` |

## aperture.generatedWorker (2)

| Code                                  | Message                                                         | Fix? | Emitted from                      |
| ------------------------------------- | --------------------------------------------------------------- | ---- | --------------------------------- |
| `aperture.generatedWorker.failed`     | Generated Aperture simulation worker failed during startup.     | yes  | `packages/app/src/worker/loop.ts` |
| `aperture.generatedWorker.tickFailed` | Generated Aperture simulation worker threw during a frame tick. | yes  | `packages/app/src/worker/loop.ts` |

## aperture.gltf (4)

| Code                            | Message                                                    | Fix? | Emitted from                       |
| ------------------------------- | ---------------------------------------------------------- | ---- | ---------------------------------- |
| `aperture.gltf.invalidNodeName` | GLTF node lookup requires a non-empty node name.           | yes  | `packages/app/src/systems/gltf.ts` |
| `aperture.gltf.nodeDuplicate`   | Found … GLTF nodes named '…' in the spawned root subtree.  | yes  | `packages/app/src/systems/gltf.ts` |
| `aperture.gltf.nodeMissing`     | No GLTF node named '…' exists in the spawned root subtree. | yes  | `packages/app/src/systems/gltf.ts` |
| `aperture.gltf.rootInactive`    | Cannot look up a GLTF node from an inactive root entity.   | yes  | `packages/app/src/systems/gltf.ts` |

## aperture.headless (3)

| Code                                | Message                                                                                                                                        | Fix? | Emitted from                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------- |
| `aperture.headless.failed`          | Aperture headless app failed.                                                                                                                  | yes  | `packages/app/src/headless.ts`                |
| `aperture.headless.invalidMode`     | Aperture headless runner requires mode: 'headless'.                                                                                            | yes  | `packages/app/src/headless.ts`                |
| `aperture.headless.toolUnavailable` | Tool '…' is not available in a headless session (v1 routes ecs\_\* tools; use the inject command for input, and 'aperture render' for pixels). | —    | `packages/cli/src/commands/headless-serve.ts` |

## aperture.input (6)

| Code                                        | Message                                                                    | Fix? | Emitted from                                |
| ------------------------------------------- | -------------------------------------------------------------------------- | ---- | ------------------------------------------- |
| `aperture.input.actionMissing`              | input_action_set requires an action name.                                  | yes  | `packages/app/src/worker/devtools/input.ts` |
| `aperture.input.actionNotFound`             | Input action '…' is not defined in aperture.config.ts.                     | yes  | `packages/app/src/worker/devtools/input.ts` |
| `aperture.input.gamepad.invalidIndex`       | Ignored a gamepad snapshot with an invalid device index.                   | —    | `packages/app/src/input/gamepads.ts`        |
| `aperture.input.gamepad.unsupportedMapping` | Ignored a connected gamepad because its browser mapping is not 'standard'. | yes  | `packages/app/src/input/gamepads.ts`        |
| `aperture.input.unknownAction`              | Input action '…' is not configured.                                        | yes  | `packages/app/src/input/state.ts`           |
| `aperture.input.unsupportedGamepadButton`   | Unsupported standard gamepad button '…'.                                   | yes  | `packages/app/src/worker/devtools/input.ts` |

## aperture.materials (2)

| Code                                 | Message                                                               | Fix? | Emitted from                            |
| ------------------------------------ | --------------------------------------------------------------------- | ---- | --------------------------------------- |
| `aperture.materials.notReady`        | Material '…' is not registered with a ready asset.                    | —    | `packages/app/src/systems/materials.ts` |
| `aperture.materials.unsupportedKind` | Material '…' of kind '…' does not support runtime parameter mutation. | —    | `packages/app/src/systems/materials.ts` |

## aperture.mcp (7)

| Code                                | Message                                                                                                          | Fix? | Emitted from                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `aperture.mcp.browserConnectFailed` | The active Aperture dev session browser could not be reached over CDP.                                           | yes  | `packages/cli/src/tools/client.ts`                                            |
| `aperture.mcp.browserUnavailable`   | The active Aperture dev session does not expose a browser debugging endpoint.                                    | yes  | `packages/cli/src/tools/client.ts`                                            |
| `aperture.mcp.sessionMissing`       | No Aperture dev session exists. Run 'aperture dev up' before using browser, ECS, input, camera, or render tools. | yes  | `packages/cli/src/tools/client.ts`                                            |
| `aperture.mcp.toolUnsupported`      | Unknown Aperture reference tool.                                                                                 | —    | `packages/cli/src/tools/dispatch.ts`<br>`packages/cli/src/tools/reference.ts` |
| `aperture.mcp.webgpuTimeout`        | Timed out waiting …ms for the generated Aperture app to report WebGPU readiness.                                 | yes  | `packages/cli/src/tools/browser.ts`                                           |
| `aperture.mcp.webgpuUnavailable`    | The generated Aperture app reported WebGPU initialization failure.                                               | yes  | `packages/cli/src/tools/browser.ts`                                           |
| `aperture.mcp.workerError`          | The generated Aperture app reported a worker error before WebGPU became ready.                                   | yes  | `packages/cli/src/tools/browser.ts`                                           |

## aperture.physics (23)

| Code                                                        | Message                                                                                                          | Fix? | Emitted from                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------- |
| `aperture.physics.breakJoint.missingEntity`                 | physics_break_joint requires an entity reference with { index, generation }.                                     | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.breakJoint.noop`                          | physics_break_joint did not break a joint because the entity has no enabled PhysicsJoint component.              | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.collider.invalidHalfExtent`               | Box collider half extents must all be positive finite numbers.                                                   | —    | `packages/physics/src/validation.ts`         |
| `aperture.physics.collider.unsupportedShape`                | Collider shape kind is not supported.                                                                            | —    | `packages/physics/src/validation.ts`         |
| `aperture.physics.command.missingEntity`                    | … requires an entity reference with { index, generation }.                                                       | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.debugGeometry.invalidOptions`             | physics_debug_geometry received malformed debug geometry options.                                                | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.fixedStepDisabled`                        | Aperture physics requires an enabled fixed-step clock.                                                           | yes  | `packages/app/src/advanced.ts`               |
| `aperture.physics.joint.invalidLimitRange`                  | Joint maxLimit must be greater than or equal to minLimit.                                                        | —    | `packages/physics/src/validation.ts`         |
| `aperture.physics.jointStatus.missingEntity`                | physics_joint_status requires an entity reference with { index, generation }.                                    | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.jointStatus.missingJoint`                 | physics_joint_status received an entity without a PhysicsJoint component.                                        | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.moveCharacter.invalidPayload`             | physics_move_character requires finite desiredTranslation [x, y, z] values.                                      | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.moveCharacter.invalidSettings`            | physics_move_character settings must be an object when provided.                                                 | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.moveCharacter.missingEntity`              | physics_move_character requires an entity reference string or { index, generation } object.                      | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.moveCharacter.noResult`                   | physics_move_character could not move the requested entity because no backend character body/collider was found. | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.projectPoint.invalidPoint`                | physics_project_point requires a finite point [x, y, z] tuple.                                                   | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.raycast.invalidRay`                       | Physics raycast tools require finite origin and nonzero direction [x, y, z] tuples.                              | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.rigidBody.invalidType`                    | RigidBody type '…' is not supported.                                                                             | —    | `packages/physics/src/validation.ts`         |
| `aperture.physics.scene.collider.missingHeightfieldAssetId` | Serialized heightfield collider on entity '…' is missing a heightfieldAssetId.                                   | —    | `packages/physics/src/validation.ts`         |
| `aperture.physics.scene.collider.missingMeshId`             | Serialized … collider on entity '…' is missing a meshId.                                                         | —    | `packages/physics/src/validation.ts`         |
| `aperture.physics.scene.collider.staleHeightfieldAssetId`   | Serialized heightfield collider on entity '…' references missing heightfield asset '…'.                          | —    | `packages/physics/src/validation.ts`         |
| `aperture.physics.scene.collider.staleMeshId`               | Serialized … collider on entity '…' references missing mesh '…'.                                                 | —    | `packages/physics/src/validation.ts`         |
| `aperture.physics.shapeCast.invalidPayload`                 | physics_cast_shape_first requires { shape, from, to } with finite primitive shape and transform values.          | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.physics.shapeQuery.invalidPayload`                | physics_overlap_shape requires { shape, transform } with finite primitive shape and transform values.            | yes  | `packages/app/src/worker/devtools/bridge.ts` |

## aperture.prefab (4)

| Code                                       | Message                                               | Fix? | Emitted from                                      |
| ------------------------------------------ | ----------------------------------------------------- | ---- | ------------------------------------------------- |
| `aperture.prefab.overrideComponentMissing` | Prefab instance '…' has no component '…' to override. | —    | `packages/simulation/src/serialization/prefab.ts` |
| `aperture.prefab.unknownOverrideComponent` | Prefab override targets unregistered component '…'.   | —    | `packages/simulation/src/serialization/prefab.ts` |
| `aperture.prefab.unknownOverrideField`     | Component '…' has no field '…'.                       | —    | `packages/simulation/src/serialization/prefab.ts` |
| `aperture.prefab.unknownOverrideId`        | Prefab override targets unknown prefab-local id '…'.  | —    | `packages/simulation/src/serialization/prefab.ts` |

## aperture.reference (7)

| Code                                | Message                                                                             | Fix? | Emitted from                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------- |
| `aperture.reference.fileCorrupt`    | Reference payload file '…' does not match the manifest hash.                        | yes  | `packages/cli/src/reference/manifest.ts`                                           |
| `aperture.reference.fileMissing`    | Reference payload file '…' is missing.                                              | yes  | `packages/cli/src/reference/manifest.ts`                                           |
| `aperture.reference.fileNotIndexed` | The requested file is not present in the warmed reference corpus.                   | —    | `packages/cli/src/tools/reference.ts`                                              |
| `aperture.reference.indexCorrupt`   | The warmed reference corpus was produced with a different embedding model contract. | yes  | `packages/cli/src/reference/status.ts`                                             |
| `aperture.reference.indexMissing`   | The warmed reference corpus was produced with a different embedding model contract. | yes  | `packages/cli/src/reference/status.ts`                                             |
| `aperture.reference.modelMismatch`  | The manifest model contract does not match the CLI query model contract.            | yes  | `packages/cli/src/reference/manifest.ts`<br>`packages/cli/src/reference/status.ts` |
| `aperture.reference.modelMissing`   | Aperture reference embedding model files are missing from ….                        | yes  | `packages/cli/src/reference/status.ts`                                             |

## aperture.render (7)

| Code                                        | Message                                                                                                               | Fix? | Emitted from                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `aperture.render.canvasMissing`             | No HTML canvas was found for managed-browser entity pick.                                                             | —    | `packages/app/src/browser/devtools/picking.ts`                                                     |
| `aperture.render.pickOutOfBounds`           | Pick point is outside the …x… canvas.                                                                                 | —    | `packages/app/src/browser/devtools/picking.ts`                                                     |
| `aperture.render.readbackSampleOutOfBounds` | Readback sample '…' is outside the …x… canvas.                                                                        | —    | `packages/app/src/browser/devtools/canvas-readback.ts`<br>`packages/cli/src/tools/png-readback.ts` |
| `aperture.render.sampleCount.clamped`       | WebGPU generated apps currently support MSAA sample counts 1 and 4; this value will be clamped by the WebGPU backend. | yes  | `packages/app/src/browser/render.ts`                                                               |
| `aperture.render.sampleCount.invalid`       | Generated app render.sampleCount must be a finite positive number; using the default 4x MSAA.                         | yes  | `packages/app/src/browser/render.ts`                                                               |
| `aperture.render.webgpuNotReady`            | WebGPU has not finished initializing in this managed tab.                                                             | —    | `packages/app/src/browser/devtools/picking.ts`                                                     |
| `aperture.render.webgpuUnavailable`         | WebGPU initialization failed, so entity picking is unavailable.                                                       | —    | `packages/app/src/browser/devtools/picking.ts`                                                     |

## aperture.resource (3)

| Code                                      | Message                                         | Fix? | Emitted from                                 |
| ----------------------------------------- | ----------------------------------------------- | ---- | -------------------------------------------- |
| `aperture.resource.invalidDevtoolsId`     | resource_get id must be a non-empty string.     | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.resource.invalidDevtoolsValues` | resource_set values must be a non-empty object. | yes  | `packages/app/src/worker/devtools/bridge.ts` |
| `aperture.resource.notFound`              | resource_set id must be a non-empty string.     | yes  | `packages/app/src/worker/devtools/bridge.ts` |

## aperture.scene (1)

| Code                                  | Message                                                                             | Fix? | Emitted from                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `aperture.scene.unknownFormatVersion` | Unsupported scene document formatVersion '…'; expected …. Nothing was instantiated. | —    | `packages/simulation/src/serialization/scene-document.ts` |

## aperture.serialization (4)

| Code                                               | Message                                                       | Fix? | Emitted from                                               |
| -------------------------------------------------- | ------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `aperture.serialization.invalidEntityRefString`    | Expected serialized entity ref string for ….…; field cleared. | —    | `packages/simulation/src/serialization/component-codec.ts` |
| `aperture.serialization.unregisteredComponent`     | No registered component for id '…'; component skipped.        | —    | `packages/simulation/src/serialization/component-codec.ts` |
| `aperture.serialization.unresolvedEntityRef`       | Could not resolve entity ref '…' for ….…; set to null.        | —    | `packages/simulation/src/serialization/component-codec.ts` |
| `aperture.serialization.unresolvedEntityRefString` | Could not resolve entity ref '…' for ….…; field cleared.      | —    | `packages/simulation/src/serialization/component-codec.ts` |

## aperture.system (3)

| Code                                   | Message                                                                              | Fix? | Emitted from                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------------------- |
| `aperture.system.invalidDefaultExport` | Discovered system module at index … does not export an EliCS system class.           | yes  | `packages/app/src/advanced.ts`                                                   |
| `aperture.system.invalidPriority`      | Discovered system module at index … has an invalid createSystem descriptor priority. | yes  | `packages/app/src/advanced.ts`<br>`packages/vite-plugin/src/system-discovery.ts` |
| `aperture.system.missingDefaultExport` | Discovered system module at index … has no default export.                           | yes  | `packages/app/src/advanced.ts`<br>`packages/vite-plugin/src/system-discovery.ts` |

## aperture.systemGlob (1)

| Code                        | Message                                  | Fix? | Emitted from                                   |
| --------------------------- | ---------------------------------------- | ---- | ---------------------------------------------- |
| `aperture.systemGlob.empty` | System glob '…' did not match any files. | yes  | `packages/vite-plugin/src/system-discovery.ts` |

## asset.dependencyCycle (1)

| Code                    | Message                              | Fix? | Emitted from                                 |
| ----------------------- | ------------------------------------ | ---- | -------------------------------------------- |
| `asset.dependencyCycle` | Circular dependency detected at '…'. | —    | `packages/simulation/src/assets/registry.ts` |

## asset.dependencyFailed (1)

| Code                     | Message                | Fix? | Emitted from                                 |
| ------------------------ | ---------------------- | ---- | -------------------------------------------- |
| `asset.dependencyFailed` | Dependency '…' failed. | —    | `packages/simulation/src/assets/registry.ts` |

## asset.dependencyLoading (1)

| Code                      | Message                          | Fix? | Emitted from                                 |
| ------------------------- | -------------------------------- | ---- | -------------------------------------------- |
| `asset.dependencyLoading` | Dependency '…' is still loading. | —    | `packages/simulation/src/assets/registry.ts` |

## asset.dependencyMissing (1)

| Code                      | Message                 | Fix? | Emitted from                                 |
| ------------------------- | ----------------------- | ---- | -------------------------------------------- |
| `asset.dependencyMissing` | Missing dependency '…'. | —    | `packages/simulation/src/assets/registry.ts` |

## brdfLutResource.deviceUnsupported (1)

| Code                                | Message                                                                                                                  | Fix? | Emitted from                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------- |
| `brdfLutResource.deviceUnsupported` | BRDF integration LUT requires texture, compute pipeline, bind group, command encoder, uniform buffer, and queue support. | —    | `packages/webgpu/src/lighting/brdf-lut-resource.ts` |

## brdfLutResource.dispatchFailed (1)

| Code                             | Message                       | Fix? | Emitted from                                        |
| -------------------------------- | ----------------------------- | ---- | --------------------------------------------------- |
| `brdfLutResource.dispatchFailed` | (message composed at runtime) | —    | `packages/webgpu/src/lighting/brdf-lut-resource.ts` |

## brdfLutResource.pipelineUnavailable (1)

| Code                                  | Message                       | Fix? | Emitted from                                        |
| ------------------------------------- | ----------------------------- | ---- | --------------------------------------------------- |
| `brdfLutResource.pipelineUnavailable` | (message composed at runtime) | —    | `packages/webgpu/src/lighting/brdf-lut-resource.ts` |

## camera.invalidClipRange (1)

| Code                      | Message                                  | Fix? | Emitted from                                                   |
| ------------------------- | ---------------------------------------- | ---- | -------------------------------------------------------------- |
| `camera.invalidClipRange` | Cameras require near > 0 and far > near. | —    | `packages/render/src/rendering/authoring-validation-camera.ts` |

## camera.invalidProjection (1)

| Code                       | Message                                                          | Fix? | Emitted from                                                   |
| -------------------------- | ---------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `camera.invalidProjection` | Perspective cameras require 0 < fovYRadians < PI and aspect > 0. | —    | `packages/render/src/rendering/authoring-validation-camera.ts` |

## camera.invalidTemporalJitter (1)

| Code                           | Message                                              | Fix? | Emitted from                                                   |
| ------------------------------ | ---------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `camera.invalidTemporalJitter` | Camera temporalJitter values must be finite numbers. | —    | `packages/render/src/rendering/authoring-validation-camera.ts` |

## camera.invalidViewport (1)

| Code                     | Message                                                     | Fix? | Emitted from                                       |
| ------------------------ | ----------------------------------------------------------- | ---- | -------------------------------------------------- |
| `camera.invalidViewport` | … values must be finite with non-negative width and height. | —    | `packages/render/src/rendering/authoring-utils.ts` |

## camera.zeroLayerMask (1)

| Code                   | Message                            | Fix? | Emitted from                                                   |
| ---------------------- | ---------------------------------- | ---- | -------------------------------------------------------------- |
| `camera.zeroLayerMask` | Camera layerMask must not be zero. | —    | `packages/render/src/rendering/authoring-validation-camera.ts` |

## clearCompatibility.missingCommandBuffer (1)

| Code                                      | Message                                                          | Fix? | Emitted from                                              |
| ----------------------------------------- | ---------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `clearCompatibility.missingCommandBuffer` | Clear pass compatibility requires command buffer finish support. | —    | `packages/webgpu/src/render/clear/clear-compatibility.ts` |

## clearCompatibility.missingCommandEncoder (1)

| Code                                       | Message                                              | Fix? | Emitted from                                              |
| ------------------------------------------ | ---------------------------------------------------- | ---- | --------------------------------------------------------- |
| `clearCompatibility.missingCommandEncoder` | Clear pass compatibility requires a command encoder. | —    | `packages/webgpu/src/render/clear/clear-compatibility.ts` |

## clearCompatibility.missingPassBegin (1)

| Code                                  | Message                                                      | Fix? | Emitted from                                              |
| ------------------------------------- | ------------------------------------------------------------ | ---- | --------------------------------------------------------- |
| `clearCompatibility.missingPassBegin` | Clear pass compatibility requires render pass begin support. | —    | `packages/webgpu/src/render/clear/clear-compatibility.ts` |

## clearCompatibility.missingPassEnd (1)

| Code                                | Message                                                    | Fix? | Emitted from                                              |
| ----------------------------------- | ---------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `clearCompatibility.missingPassEnd` | Clear pass compatibility requires render pass end support. | —    | `packages/webgpu/src/render/clear/clear-compatibility.ts` |

## clearCompatibility.missingQueueSubmit (1)

| Code                                    | Message                                                 | Fix? | Emitted from                                              |
| --------------------------------------- | ------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `clearCompatibility.missingQueueSubmit` | Clear pass compatibility requires queue submit support. | —    | `packages/webgpu/src/render/clear/clear-compatibility.ts` |

## clearCompatibility.missingTextureView (1)

| Code                                    | Message                                                   | Fix? | Emitted from                                              |
| --------------------------------------- | --------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `clearCompatibility.missingTextureView` | Clear pass compatibility requires a current texture view. | —    | `packages/webgpu/src/render/clear/clear-compatibility.ts` |

## clearParity.bothFailed (1)

| Code                     | Message                                                                | Fix? | Emitted from                                       |
| ------------------------ | ---------------------------------------------------------------------- | ---- | -------------------------------------------------- |
| `clearParity.bothFailed` | Both clearWebGpuCanvas and frame-boundary compatibility report failed. | —    | `packages/webgpu/src/render/clear/clear-parity.ts` |

## clearParity.clearFailedBoundaryReady (1)

| Code                                   | Message                                                                     | Fix? | Emitted from                                       |
| -------------------------------------- | --------------------------------------------------------------------------- | ---- | -------------------------------------------------- |
| `clearParity.clearFailedBoundaryReady` | clearWebGpuCanvas failed while frame-boundary compatibility reported ready. | —    | `packages/webgpu/src/render/clear/clear-parity.ts` |

## clearParity.clearSucceededBoundaryFailed (1)

| Code                                       | Message                                                                                       | Fix? | Emitted from                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------- |
| `clearParity.clearSucceededBoundaryFailed` | clearWebGpuCanvas succeeded while frame-boundary compatibility reported missing requirements. | —    | `packages/webgpu/src/render/clear/clear-parity.ts` |

## commandBuffer.missingFinish (1)

| Code                          | Message                                        | Fix? | Emitted from                                |
| ----------------------------- | ---------------------------------------------- | ---- | ------------------------------------------- |
| `commandBuffer.missingFinish` | Command encoder cannot finish command buffers. | —    | `packages/webgpu/src/gpu/command-buffer.ts` |

## commandEncoder.missingCreateCommandEncoder (1)

| Code                                         | Message                                       | Fix? | Emitted from                                 |
| -------------------------------------------- | --------------------------------------------- | ---- | -------------------------------------------- |
| `commandEncoder.missingCreateCommandEncoder` | WebGPU device cannot create command encoders. | —    | `packages/webgpu/src/gpu/command-encoder.ts` |

## commandSubmissionMetrics.executionFailed (1)

| Code                                       | Message                               | Fix? | Emitted from                                            |
| ------------------------------------------ | ------------------------------------- | ---- | ------------------------------------------------------- |
| `commandSubmissionMetrics.executionFailed` | Render pass command execution failed. | —    | `packages/webgpu/src/gpu/command-submission-metrics.ts` |

## commandSubmissionMetrics.finishFailed (1)

| Code                                    | Message                        | Fix? | Emitted from                                            |
| --------------------------------------- | ------------------------------ | ---- | ------------------------------------------------------- |
| `commandSubmissionMetrics.finishFailed` | Command encoder finish failed. | —    | `packages/webgpu/src/gpu/command-submission-metrics.ts` |

## commandSubmissionMetrics.submitFailed (1)

| Code                                    | Message                  | Fix? | Emitted from                                            |
| --------------------------------------- | ------------------------ | ---- | ------------------------------------------------------- |
| `commandSubmissionMetrics.submitFailed` | Queue submission failed. | —    | `packages/webgpu/src/gpu/command-submission-metrics.ts` |

## computePassCommand.invalidWorkgroupCount (1)

| Code                                       | Message                                                       | Fix? | Emitted from                                                 |
| ------------------------------------------ | ------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `computePassCommand.invalidWorkgroupCount` | Indirect compute dispatch issued before a pipeline was bound. | —    | `packages/webgpu/src/render/passes/compute-pass-commands.ts` |

## computePassCommand.missingPipeline (1)

| Code                                 | Message                                              | Fix? | Emitted from                                                 |
| ------------------------------------ | ---------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `computePassCommand.missingPipeline` | Compute dispatch issued before a pipeline was bound. | —    | `packages/webgpu/src/render/passes/compute-pass-commands.ts` |

## computePassCommandExecutor.missingMethod (1)

| Code                                       | Message                                         | Fix? | Emitted from                                                 |
| ------------------------------------------ | ----------------------------------------------- | ---- | ------------------------------------------------------------ |
| `computePassCommandExecutor.missingMethod` | Compute pass encoder is missing the '…' method. | —    | `packages/webgpu/src/render/passes/compute-pass-commands.ts` |

## currentTextureView.missingCurrentTexture (1)

| Code                                       | Message                                           | Fix? | Emitted from                                                   |
| ------------------------------------------ | ------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `currentTextureView.missingCurrentTexture` | WebGPU context did not provide a current texture. | —    | `packages/webgpu/src/app/presentation/current-texture-view.ts` |

## currentTextureView.missingTexture (1)

| Code                                | Message                                     | Fix? | Emitted from                                                   |
| ----------------------------------- | ------------------------------------------- | ---- | -------------------------------------------------------------- |
| `currentTextureView.missingTexture` | Off-screen color target requires a texture. | —    | `packages/webgpu/src/app/presentation/current-texture-view.ts` |

## currentTextureView.missingTextureView (1)

| Code                                    | Message                                                | Fix? | Emitted from                                                   |
| --------------------------------------- | ------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `currentTextureView.missingTextureView` | WebGPU current texture did not provide a texture view. | —    | `packages/webgpu/src/app/presentation/current-texture-view.ts` |

## customMaterialSource.invalidBindingDeclaration (1)

| Code                                             | Message               | Fix? | Emitted from                                                    |
| ------------------------------------------------ | --------------------- | ---- | --------------------------------------------------------------- |
| `customMaterialSource.invalidBindingDeclaration` | Custom material '…' … | —    | `packages/render/src/assets/custom-wgsl-material-validation.ts` |

## customMaterialSource.invalidDependency (1)

| Code                                     | Message                                                                          | Fix? | Emitted from                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `customMaterialSource.invalidDependency` | Custom material '…' shader must be an inline WGSL source or shader asset handle. | —    | `packages/render/src/assets/custom-wgsl-material-validation.ts` |

## customMaterialSource.invalidDiscriminator (1)

| Code                                        | Message                                                                                              | Fix? | Emitted from                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `customMaterialSource.invalidDiscriminator` | Custom material '…' must use sourceDiscriminator 'custom-material-source' and shaderLanguage 'wgsl'. | —    | `packages/render/src/assets/custom-wgsl-material-validation.ts` |

## customMaterialSource.invalidFamilyKey (1)

| Code                                    | Message                                                  | Fix? | Emitted from                                                    |
| --------------------------------------- | -------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `customMaterialSource.invalidFamilyKey` | Custom material '…' must provide a namespaced familyKey. | —    | `packages/render/src/assets/custom-wgsl-material-validation.ts` |

## customMaterialSource.invalidLabel (1)

| Code                                | Message                                             | Fix? | Emitted from                                                    |
| ----------------------------------- | --------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `customMaterialSource.invalidLabel` | Custom material '…' must provide a non-empty label. | —    | `packages/render/src/assets/custom-wgsl-material-validation.ts` |

## customMaterialSource.invalidMetadata (1)

| Code                                   | Message                                                                                                                                 | Fix? | Emitted from                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `customMaterialSource.invalidMetadata` | Custom material '…' metadata must be JSON-safe and must not contain typed arrays, functions, maps, sets, promises, or renderer objects. | —    | `packages/render/src/assets/custom-wgsl-material-validation.ts` |

## customMaterialSource.invalidPipelineKeyInput (1)

| Code                                           | Message                                            | Fix? | Emitted from                                                    |
| ---------------------------------------------- | -------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `customMaterialSource.invalidPipelineKeyInput` | Custom material '…' pipelineKey must be an object. | —    | `packages/render/src/assets/custom-wgsl-material-validation.ts` |

## customMaterialSource.invalidRenderState (1)

| Code                                      | Message                                                    | Fix? | Emitted from                                                    |
| ----------------------------------------- | ---------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `customMaterialSource.invalidRenderState` | Custom material '…' has an invalid renderState descriptor. | —    | `packages/render/src/assets/custom-wgsl-material-validation.ts` |

## customMaterialSource.liveRendererObject (1)

| Code                                      | Message                                                                    | Fix? | Emitted from                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `customMaterialSource.liveRendererObject` | Custom material '…' contains non-serializable or renderer-owned data at …. | —    | `packages/render/src/assets/custom-wgsl-material-validation.ts` |

## customMaterialSource.reservedFamilyKey (1)

| Code                                     | Message                                                                       | Fix? | Emitted from                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `customMaterialSource.reservedFamilyKey` | Custom material '…' familyKey '…' is reserved for a built-in material family. | —    | `packages/render/src/assets/custom-wgsl-material-validation.ts` |

## customWgslAppFrameResources.missingPipelineLayouts (1)

| Code                                                 | Message                                                                          | Fix? | Emitted from                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `customWgslAppFrameResources.missingPipelineLayouts` | Custom WGSL pipeline does not expose bind group layouts for app frame resources. | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-app-frame-resources.ts` |

## customWgslAppFrameResources.runtimeUniformBufferFailed (1)

| Code                                                     | Message                       | Fix? | Emitted from                                                                   |
| -------------------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------------------------------ |
| `customWgslAppFrameResources.runtimeUniformBufferFailed` | (message composed at runtime) | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-app-frame-resources.ts` |

## customWgslAppFrameResources.runtimeUniformInvalidValue (1)

| Code                                                     | Message                                                                  | Fix? | Emitted from                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------ |
| `customWgslAppFrameResources.runtimeUniformInvalidValue` | Runtime uniform '…' value '…' does not match custom WGSL field type '…'. | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-app-frame-resources.ts` |

## customWgslAppFrameResources.runtimeUniformMissing (1)

| Code                                                | Message                                                                                                        | Fix? | Emitted from                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `customWgslAppFrameResources.runtimeUniformMissing` | Custom WGSL binding … requires runtime uniform '…', but no runtime uniform packet with that key was extracted. | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-app-frame-resources.ts` |

## customWgslAppFrameResources.runtimeUniformMissingFields (1)

| Code                                                      | Message                                                                        | Fix? | Emitted from                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------ |
| `customWgslAppFrameResources.runtimeUniformMissingFields` | Runtime uniform '…' is missing value(s) for …; material defaults will be used. | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-app-frame-resources.ts` |

## customWgslAppFrameResources.runtimeUniformWriteFailed (1)

| Code                                                    | Message                                                 | Fix? | Emitted from                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `customWgslAppFrameResources.runtimeUniformWriteFailed` | WebGPU device cannot write updated runtime uniform '…'. | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-app-frame-resources.ts` |

## customWgslAppFrameResources.uniformBufferFailed (1)

| Code                                              | Message                       | Fix? | Emitted from                                                                   |
| ------------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------------------------------ |
| `customWgslAppFrameResources.uniformBufferFailed` | (message composed at runtime) | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-app-frame-resources.ts` |

## customWgslAppFrameResources.unsupportedBindingKind (1)

| Code                                                 | Message                                                                    | Fix? | Emitted from                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `customWgslAppFrameResources.unsupportedBindingKind` | Custom WGSL app route currently supports uniform-buffer bindings, not '…'. | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-app-frame-resources.ts` |

## customWgslMaterial.bindGroupCreationFailed (1)

| Code                                         | Message                                        | Fix? | Emitted from                                                        |
| -------------------------------------------- | ---------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `customWgslMaterial.bindGroupCreationFailed` | Failed to create custom WGSL bind group '…': … | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-material.ts` |

## customWgslMaterial.createBindGroupUnavailable (1)

| Code                                            | Message                                              | Fix? | Emitted from                                                        |
| ----------------------------------------------- | ---------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `customWgslMaterial.createBindGroupUnavailable` | WebGPU device cannot create custom WGSL bind groups. | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-material.ts` |

## customWgslMaterial.createRenderPipelineUnavailable (1)

| Code                                                 | Message                                                   | Fix? | Emitted from                                                        |
| ---------------------------------------------------- | --------------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `customWgslMaterial.createRenderPipelineUnavailable` | WebGPU device cannot create custom WGSL render pipelines. | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-material.ts` |

## customWgslMaterial.missingBindingResource (1)

| Code                                        | Message                                             | Fix? | Emitted from                                                        |
| ------------------------------------------- | --------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `customWgslMaterial.missingBindingResource` | Missing GPU resource '…' for custom WGSL binding …. | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-material.ts` |

## customWgslMaterial.missingPipelineLayout (1)

| Code                                       | Message                                                                         | Fix? | Emitted from                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `customWgslMaterial.missingPipelineLayout` | Custom WGSL material bind group creation requires pipeline bind group layout 2. | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-material.ts` |

## customWgslMaterial.pipelineCreationFailed (1)

| Code                                        | Message                                             | Fix? | Emitted from                                                        |
| ------------------------------------------- | --------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `customWgslMaterial.pipelineCreationFailed` | Failed to create custom WGSL render pipeline '…': … | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-material.ts` |

## customWgslMaterial.shaderCreationFailed (1)

| Code                                      | Message                                                   | Fix? | Emitted from                                                        |
| ----------------------------------------- | --------------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `customWgslMaterial.shaderCreationFailed` | WebGPU device cannot create custom WGSL render pipelines. | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-material.ts` |

## customWgslMaterial.shaderDiagnostic (1)

| Code                                  | Message                       | Fix? | Emitted from                                                        |
| ------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------------------- |
| `customWgslMaterial.shaderDiagnostic` | (message composed at runtime) | —    | `packages/webgpu/src/materials/custom-wgsl/custom-wgsl-material.ts` |

## debugNormalFrameResources.missingMaterial (1)

| Code                                        | Message                                                                         | Fix? | Emitted from                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `debugNormalFrameResources.missingMaterial` | DebugNormal frame GPU resource creation requires a debug-normal material asset. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-frame-resources.ts` |

## debugNormalFrameResources.missingMesh (1)

| Code                                    | Message                                                        | Fix? | Emitted from                                                                 |
| --------------------------------------- | -------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `debugNormalFrameResources.missingMesh` | DebugNormal frame GPU resource creation requires a mesh asset. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-frame-resources.ts` |

## debugNormalFrameResources.missingViewUniforms (1)

| Code                                            | Message                                                                | Fix? | Emitted from                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `debugNormalFrameResources.missingViewUniforms` | DebugNormal frame GPU resource creation requires packed view uniforms. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-frame-resources.ts` |

## debugNormalFrameResources.missingWorldTransforms (1)

| Code                                               | Message                                                                   | Fix? | Emitted from                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `debugNormalFrameResources.missingWorldTransforms` | DebugNormal frame GPU resource creation requires packed world transforms. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-frame-resources.ts` |

## debugNormalMaterialBindGroup.missingMaterialResource (1)

| Code                                                   | Message                                                                               | Fix? | Emitted from                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `debugNormalMaterialBindGroup.missingMaterialResource` | DebugNormal material bind group planning requires a material uniform buffer resource. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-bind-group.ts` |

## debugNormalMaterialBindGroupLayout.invalidGroup (1)

| Code                                              | Message                                                                 | Fix? | Emitted from                                                                   |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `debugNormalMaterialBindGroupLayout.invalidGroup` | DebugNormal material resources must use bind group 2; received group …. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-bind-group-layout.ts` |

## debugNormalMaterialBindGroupLayout.missingBinding (1)

| Code                                                | Message                                                               | Fix? | Emitted from                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `debugNormalMaterialBindGroupLayout.missingBinding` | DebugNormal material bind group layout is missing required binding …. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-bind-group-layout.ts` |

## debugNormalMaterialBindGroupLayout.resourceKindMismatch (1)

| Code                                                      | Message                                                           | Fix? | Emitted from                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `debugNormalMaterialBindGroupLayout.resourceKindMismatch` | DebugNormal material binding … must be 'uniform-buffer', not '…'. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-bind-group-layout.ts` |

## debugNormalMaterialBindGroupResource.creationFailed (1)

| Code                                                  | Message                                                  | Fix? | Emitted from                                                            |
| ----------------------------------------------------- | -------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `debugNormalMaterialBindGroupResource.creationFailed` | Failed to create debug-normal material bind group '…': … | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-bind-group.ts` |

## debugNormalMaterialBindGroupResource.invalidDescriptorPlan (1)

| Code                                                         | Message                                                                           | Fix? | Emitted from                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `debugNormalMaterialBindGroupResource.invalidDescriptorPlan` | Cannot create a debug-normal material bind group from an invalid descriptor plan. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-bind-group.ts` |

## debugNormalMaterialBindGroupResource.invalidLayout (1)

| Code                                                 | Message                                                                 | Fix? | Emitted from                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `debugNormalMaterialBindGroupResource.invalidLayout` | DebugNormal material bind group layout resource must be group 2, not …. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-bind-group.ts` |

## debugNormalMaterialBindGroupResource.missingBufferResource (1)

| Code                                                         | Message                                                            | Fix? | Emitted from                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------- |
| `debugNormalMaterialBindGroupResource.missingBufferResource` | Missing GPU buffer resource '…' for debug-normal material group 2. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-bind-group.ts` |

## debugNormalMaterialBindGroupResource.missingDeviceSupport (1)

| Code                                                        | Message                                                        | Fix? | Emitted from                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `debugNormalMaterialBindGroupResource.missingDeviceSupport` | WebGPU device cannot create debug-normal material bind groups. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-bind-group.ts` |

## debugNormalMaterialBindGroupResource.missingLayout (1)

| Code                                                 | Message                                                                      | Fix? | Emitted from                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `debugNormalMaterialBindGroupResource.missingLayout` | DebugNormal material bind group creation requires a group-2 layout resource. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-bind-group.ts` |

## debugNormalMaterialBindGroupResource.nullDescriptorPlan (1)

| Code                                                      | Message                                                                       | Fix? | Emitted from                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `debugNormalMaterialBindGroupResource.nullDescriptorPlan` | Cannot create a debug-normal material bind group from a null descriptor plan. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-bind-group.ts` |

## debugNormalMaterialBuffer.invalidUniformData (1)

| Code                                           | Message                                                                            | Fix? | Emitted from                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `debugNormalMaterialBuffer.invalidUniformData` | Packed debug-normal material uniform data must match the documented …-byte layout. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-material-buffer.ts` |

## debugNormalMaterialBuffer.invalidUsageFlags (1)

| Code                                          | Message                                                                     | Fix? | Emitted from                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `debugNormalMaterialBuffer.invalidUsageFlags` | DebugNormal material uniform buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-material-buffer.ts` |

## debugNormalMaterialBuffer.nullPackedMaterial (1)

| Code                                           | Message                                                                                 | Fix? | Emitted from                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `debugNormalMaterialBuffer.nullPackedMaterial` | Cannot create a debug-normal material buffer descriptor from null packed material data. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-material-buffer.ts` |

## debugNormalMaterialGpuBuffer.creationFailed (1)

| Code                                          | Message                                                      | Fix? | Emitted from                                                                          |
| --------------------------------------------- | ------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------- |
| `debugNormalMaterialGpuBuffer.creationFailed` | Failed to create debug-normal material uniform buffer '…': … | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-material-buffer-resource.ts` |

## debugNormalMaterialGpuBuffer.nullDescriptorPlan (1)

| Code                                              | Message                                                                       | Fix? | Emitted from                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| `debugNormalMaterialGpuBuffer.nullDescriptorPlan` | Cannot create a debug-normal material GPU buffer from a null descriptor plan. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-material-buffer-resource.ts` |

## debugNormalMaterialPack.unsupportedMaterialKind (1)

| Code                                              | Message                                                      | Fix? | Emitted from                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------ | ---- | ---------------------------------------------------------------------------- |
| `debugNormalMaterialPack.unsupportedMaterialKind` | DebugNormal material packing does not support '…' materials. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-material-buffer.ts` |

## debugNormalPipeline.missingBatchKeyField (1)

| Code                                       | Message                                                                | Fix? | Emitted from                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `debugNormalPipeline.missingBatchKeyField` | DebugNormalMaterial pipeline descriptor planning requires a batch key. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-pipeline-descriptor.ts` |

## debugNormalPipeline.missingColorFormat (1)

| Code                                     | Message                                                                   | Fix? | Emitted from                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `debugNormalPipeline.missingColorFormat` | DebugNormalMaterial pipeline descriptor planning requires a color format. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-pipeline-descriptor.ts` |

## debugNormalPipeline.missingShaderMetadata (1)

| Code                                        | Message                                                                   | Fix? | Emitted from                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `debugNormalPipeline.missingShaderMetadata` | DebugNormalMaterial pipeline descriptor planning requires a color format. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-pipeline-descriptor.ts` |

## debugNormalPipeline.missingVertexAttribute (1)

| Code                                         | Message                                                          | Fix? | Emitted from                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `debugNormalPipeline.missingVertexAttribute` | DebugNormalMaterial pipeline requires '…' vertex attribute data. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-pipeline-descriptor.ts` |

## debugNormalPipeline.unsupportedFeature (1)

| Code                                     | Message                                                    | Fix? | Emitted from                                                                     |
| ---------------------------------------- | ---------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `debugNormalPipeline.unsupportedFeature` | DebugNormalMaterial pipeline does not support feature '…'. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-pipeline-descriptor.ts` |

## debugNormalPipeline.unsupportedShaderFamily (1)

| Code                                          | Message                                                                                                    | Fix? | Emitted from                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `debugNormalPipeline.unsupportedShaderFamily` | DebugNormalMaterial pipeline descriptor planning requires a 'debug-normal' material pipeline key, not '…'. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-pipeline-descriptor.ts` |

## debugNormalPipeline.unsupportedTopology (1)

| Code                                      | Message                                                                | Fix? | Emitted from                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `debugNormalPipeline.unsupportedTopology` | DebugNormalMaterial pipeline supports triangle-list topology, not '…'. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-pipeline-descriptor.ts` |

## debugNormalRenderPipeline.createRenderPipelineUnavailable (1)

| Code                                                        | Message                                                      | Fix? | Emitted from                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------ | ---- | --------------------------------------------------------------------- |
| `debugNormalRenderPipeline.createRenderPipelineUnavailable` | WebGPU device cannot create debug-normal material pipelines. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-pipeline.ts` |

## debugNormalRenderPipeline.descriptorPlanFailed (1)

| Code                                             | Message                       | Fix? | Emitted from                                                          |
| ------------------------------------------------ | ----------------------------- | ---- | --------------------------------------------------------------------- |
| `debugNormalRenderPipeline.descriptorPlanFailed` | (message composed at runtime) | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-pipeline.ts` |

## debugNormalRenderPipeline.pipelineCreationFailed (1)

| Code                                               | Message                       | Fix? | Emitted from                                                          |
| -------------------------------------------------- | ----------------------------- | ---- | --------------------------------------------------------------------- |
| `debugNormalRenderPipeline.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-pipeline.ts` |

## debugNormalRenderPipeline.shaderCreationFailed (1)

| Code                                             | Message                                                      | Fix? | Emitted from                                                          |
| ------------------------------------------------ | ------------------------------------------------------------ | ---- | --------------------------------------------------------------------- |
| `debugNormalRenderPipeline.shaderCreationFailed` | WebGPU device cannot create debug-normal material pipelines. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-pipeline.ts` |

## debugNormalRenderPipeline.shaderDiagnostic (1)

| Code                                         | Message                       | Fix? | Emitted from                                                          |
| -------------------------------------------- | ----------------------------- | ---- | --------------------------------------------------------------------- |
| `debugNormalRenderPipeline.shaderDiagnostic` | (message composed at runtime) | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-pipeline.ts` |

## diffuseIblResourceSummary.resourceUnsupported (1)

| Code                                            | Message                                                                                 | Fix? | Emitted from                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `diffuseIblResourceSummary.resourceUnsupported` | Diffuse IBL resource summary cannot proceed while an IBL resource input is unsupported. | —    | `packages/webgpu/src/lighting/diffuse-ibl-resource-summary.ts` |

## diffuseIblResourceSummary.samplerResourceMissing (1)

| Code                                               | Message                                                                | Fix? | Emitted from                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `diffuseIblResourceSummary.samplerResourceMissing` | Diffuse IBL resource summary requires available IBL sampler resources. | —    | `packages/webgpu/src/lighting/diffuse-ibl-resource-summary.ts` |

## diffuseIblResourceSummary.textureResourceMissing (1)

| Code                                               | Message                                                                      | Fix? | Emitted from                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `diffuseIblResourceSummary.textureResourceMissing` | Diffuse IBL resource summary requires an available diffuse texture resource. | —    | `packages/webgpu/src/lighting/diffuse-ibl-resource-summary.ts` |

## directionalShadowMatrix.invalidLightDirection (1)

| Code                                            | Message                                                        | Fix? | Emitted from                                                           |
| ----------------------------------------------- | -------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `directionalShadowMatrix.invalidLightDirection` | Directional shadow plan '…' has a zero-length light direction. | —    | `packages/webgpu/src/shadows/directional-shadow-matrix-computation.ts` |

## directionalShadowMatrix.missingLightTransform (1)

| Code                                            | Message                                                                  | Fix? | Emitted from                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------ | ---- | ---------------------------------------------------------------------- |
| `directionalShadowMatrix.missingLightTransform` | Directional shadow plan '…' references missing light transform offset …. | —    | `packages/webgpu/src/shadows/directional-shadow-matrix-computation.ts` |

## directionalShadowMatrix.missingViewProjectionPlan (1)

| Code                                                | Message                                                                  | Fix? | Emitted from                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ---------------------------------------------------------------------- |
| `directionalShadowMatrix.missingViewProjectionPlan` | Directional shadow matrix computation requires view/projection planning. | —    | `packages/webgpu/src/shadows/directional-shadow-matrix-computation.ts` |

## directionalShadowMatrix.unsupportedViewProjectionPlan (1)

| Code                                                    | Message                                                                       | Fix? | Emitted from                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `directionalShadowMatrix.unsupportedViewProjectionPlan` | Directional shadow matrix computation only supports directional shadow plans. | —    | `packages/webgpu/src/shadows/directional-shadow-matrix-computation.ts` |

## directionalShadowViewProjection.matrixDeferred (1)

| Code                                             | Message                                                                                             | Fix? | Emitted from                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `directionalShadowViewProjection.matrixDeferred` | Directional shadow view/projection keys are planned, but matrix computation is not implemented yet. | —    | `packages/webgpu/src/shadows/directional-shadow-view-projection-plan.ts` |

## directionalShadowViewProjection.missingLight (1)

| Code                                           | Message                                          | Fix? | Emitted from                                                             |
| ---------------------------------------------- | ------------------------------------------------ | ---- | ------------------------------------------------------------------------ |
| `directionalShadowViewProjection.missingLight` | Shadow request '…' references missing light '…'. | —    | `packages/webgpu/src/shadows/directional-shadow-view-projection-plan.ts` |

## directionalShadowViewProjection.missingPassPlan (1)

| Code                                              | Message                                              | Fix? | Emitted from                                                             |
| ------------------------------------------------- | ---------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `directionalShadowViewProjection.missingPassPlan` | Shadow request '…' has no matching shadow pass plan. | —    | `packages/webgpu/src/shadows/directional-shadow-view-projection-plan.ts` |

## directionalShadowViewProjection.unsupportedLightKind (1)

| Code                                                   | Message                                                   | Fix? | Emitted from                                                             |
| ------------------------------------------------------ | --------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `directionalShadowViewProjection.unsupportedLightKind` | Shadow request '…' references unsupported light kind '…'. | —    | `packages/webgpu/src/shadows/directional-shadow-view-projection-plan.ts` |

## drawBatching.emptyPackages (1)

| Code                         | Message                       | Fix? | Emitted from                                       |
| ---------------------------- | ----------------------------- | ---- | -------------------------------------------------- |
| `drawBatching.emptyPackages` | (message composed at runtime) | —    | `packages/render/src/rendering/batching-report.ts` |

## drawCommand.missingInstanceAttributePacket (1)

| Code                                         | Message                                                                               | Fix? | Emitted from                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| `drawCommand.missingInstanceAttributePacket` | Render id … uses an instance-attribute pipeline but has no instance attribute packet. | —    | `packages/webgpu/src/render/draw/draw-command.ts` |

## drawCommand.missingInstanceAttributeResource (1)

| Code                                           | Message                                                                                               | Fix? | Emitted from                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| `drawCommand.missingInstanceAttributeResource` | Render id … uses an instance-attribute pipeline but no instance attribute vertex buffer is available. | —    | `packages/webgpu/src/render/draw/draw-command.ts` |

## drawCommand.missingInstanceTintOffset (1)

| Code                                    | Message                                                                            | Fix? | Emitted from                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| `drawCommand.missingInstanceTintOffset` | Render id … uses an instance-tint pipeline but has no instance tint packet offset. | —    | `packages/webgpu/src/render/draw/draw-command.ts` |

## drawCommand.missingInstanceTintResource (1)

| Code                                      | Message                                                                                     | Fix? | Emitted from                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| `drawCommand.missingInstanceTintResource` | Render id … uses an instance-tint pipeline but no instance tint vertex buffer is available. | —    | `packages/webgpu/src/render/draw/draw-command.ts` |

## drawCommand.missingMeshResource (1)

| Code                              | Message                                    | Fix? | Emitted from                                      |
| --------------------------------- | ------------------------------------------ | ---- | ------------------------------------------------- |
| `drawCommand.missingMeshResource` | Missing mesh resource '…' for render id …. | —    | `packages/webgpu/src/render/draw/draw-command.ts` |

## environmentMapReadiness.missingResource (1)

| Code                                      | Message                                                                                                                  | Fix? | Emitted from                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `environmentMapReadiness.missingResource` | Environment map resource '…' is required by extracted environment packets but is not present in renderer resource state. | —    | `packages/webgpu/src/lighting/environment-map-readiness.ts` |

## equirectToCubeResource.deviceUnsupported (1)

| Code                                       | Message                                                                                                                         | Fix? | Emitted from                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `equirectToCubeResource.deviceUnsupported` | Equirect-to-cube projection requires texture, compute pipeline, bind group, command encoder, uniform buffer, and queue support. | —    | `packages/webgpu/src/lighting/equirect-to-cube-resource.ts` |

## equirectToCubeResource.dispatchFailed (1)

| Code                                    | Message                       | Fix? | Emitted from                                                |
| --------------------------------------- | ----------------------------- | ---- | ----------------------------------------------------------- |
| `equirectToCubeResource.dispatchFailed` | (message composed at runtime) | —    | `packages/webgpu/src/lighting/equirect-to-cube-resource.ts` |

## equirectToCubeResource.invalidSource (1)

| Code                                   | Message                                                                                          | Fix? | Emitted from                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `equirectToCubeResource.invalidSource` | Equirect source must be a positive width x height with at least width*height*4 rgba8unorm bytes. | —    | `packages/webgpu/src/lighting/equirect-to-cube-resource.ts` |

## equirectToCubeResource.pipelineUnavailable (1)

| Code                                         | Message                       | Fix? | Emitted from                                                |
| -------------------------------------------- | ----------------------------- | ---- | ----------------------------------------------------------- |
| `equirectToCubeResource.pipelineUnavailable` | (message composed at runtime) | —    | `packages/webgpu/src/lighting/equirect-to-cube-resource.ts` |

## fog.invalidColor (1)

| Code               | Message                                      | Fix? | Emitted from                                                    |
| ------------------ | -------------------------------------------- | ---- | --------------------------------------------------------------- |
| `fog.invalidColor` | Fog color components must be finite numbers. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## fog.invalidDensity (1)

| Code                 | Message                                                       | Fix? | Emitted from                                                    |
| -------------------- | ------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `fog.invalidDensity` | Exponential fog density must be a finite non-negative number. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## fog.invalidMode (1)

| Code              | Message                                      | Fix? | Emitted from                                                    |
| ----------------- | -------------------------------------------- | ---- | --------------------------------------------------------------- |
| `fog.invalidMode` | Fog mode must be 'linear', 'exp', or 'exp2'. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## fog.invalidRange (1)

| Code               | Message                                                           | Fix? | Emitted from                                                    |
| ------------------ | ----------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `fog.invalidRange` | Linear fog requires finite start >= 0 and end greater than start. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## frameBoundaryPassRectangle.invalidRectangle (1)

| Code                                          | Message                                                              | Fix? | Emitted from                                         |
| --------------------------------------------- | -------------------------------------------------------------------- | ---- | ---------------------------------------------------- |
| `frameBoundaryPassRectangle.invalidRectangle` | Render pass encoder cannot apply a viewport rectangle for this view. | —    | `packages/webgpu/src/render/frame/frame-boundary.ts` |

## frameBoundaryPassRectangle.missingSetScissorRect (1)

| Code                                               | Message                                                             | Fix? | Emitted from                                         |
| -------------------------------------------------- | ------------------------------------------------------------------- | ---- | ---------------------------------------------------- |
| `frameBoundaryPassRectangle.missingSetScissorRect` | Render pass encoder cannot apply a scissor rectangle for this view. | —    | `packages/webgpu/src/render/frame/frame-boundary.ts` |

## frameBoundaryPassRectangle.missingSetViewport (1)

| Code                                            | Message                                                              | Fix? | Emitted from                                         |
| ----------------------------------------------- | -------------------------------------------------------------------- | ---- | ---------------------------------------------------- |
| `frameBoundaryPassRectangle.missingSetViewport` | Render pass encoder cannot apply a viewport rectangle for this view. | —    | `packages/webgpu/src/render/frame/frame-boundary.ts` |

## frameBoundaryValidation.compatibilityNotReady (1)

| Code                                            | Message                                  | Fix? | Emitted from                                                    |
| ----------------------------------------------- | ---------------------------------------- | ---- | --------------------------------------------------------------- |
| `frameBoundaryValidation.compatibilityNotReady` | Clear compatibility report is not ready. | —    | `packages/webgpu/src/render/frame/frame-boundary-validation.ts` |

## frameBoundaryValidation.diagnosticErrors (1)

| Code                                       | Message                                               | Fix? | Emitted from                                                    |
| ------------------------------------------ | ----------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `frameBoundaryValidation.diagnosticErrors` | Frame boundary source diagnostics include … error(s). | —    | `packages/webgpu/src/render/frame/frame-boundary-validation.ts` |

## frameBoundaryValidation.diagnosticWarnings (1)

| Code                                         | Message                                                 | Fix? | Emitted from                                                    |
| -------------------------------------------- | ------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `frameBoundaryValidation.diagnosticWarnings` | Frame boundary source diagnostics include … warning(s). | —    | `packages/webgpu/src/render/frame/frame-boundary-validation.ts` |

## frameBoundaryValidation.smokeNotReady (1)

| Code                                    | Message                                   | Fix? | Emitted from                                                    |
| --------------------------------------- | ----------------------------------------- | ---- | --------------------------------------------------------------- |
| `frameBoundaryValidation.smokeNotReady` | Frame boundary smoke report is not ready. | —    | `packages/webgpu/src/render/frame/frame-boundary-validation.ts` |

## frameExecution.missingExecution (1)

| Code                              | Message                                                                                           | Fix? | Emitted from                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `frameExecution.missingExecution` | Frame execution report cannot create command submission metrics without command execution output. | —    | `packages/webgpu/src/render/frame/frame-execution-report.ts` |

## frameExecution.missingFinish (1)

| Code                           | Message                                                                                               | Fix? | Emitted from                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `frameExecution.missingFinish` | Frame execution report cannot create command submission metrics without command buffer finish output. | —    | `packages/webgpu/src/render/frame/frame-execution-report.ts` |

## frameExecution.missingSubmit (1)

| Code                           | Message                                                                                          | Fix? | Emitted from                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------ |
| `frameExecution.missingSubmit` | Frame execution report cannot create command submission metrics without queue submission output. | —    | `packages/webgpu/src/render/frame/frame-execution-report.ts` |

## frameGraph.cyclicDependency (1)

| Code                          | Message                                     | Fix? | Emitted from                                              |
| ----------------------------- | ------------------------------------------- | ---- | --------------------------------------------------------- |
| `frameGraph.cyclicDependency` | Cyclic resource dependency among passes: …. | —    | `packages/webgpu/src/render/graph/frame-graph-compile.ts` |

## frameGraph.duplicateNodeName (1)

| Code                           | Message                       | Fix? | Emitted from                                              |
| ------------------------------ | ----------------------------- | ---- | --------------------------------------------------------- |
| `frameGraph.duplicateNodeName` | Duplicate pass node name '…'. | —    | `packages/webgpu/src/render/graph/frame-graph-compile.ts` |

## frameGraph.unknownReadHandle (1)

| Code                           | Message                               | Fix? | Emitted from                                              |
| ------------------------------ | ------------------------------------- | ---- | --------------------------------------------------------- |
| `frameGraph.unknownReadHandle` | Pass '…' reads undeclared handle '…'. | —    | `packages/webgpu/src/render/graph/frame-graph-compile.ts` |

## frameGraph.unknownWriteHandle (1)

| Code                            | Message                                | Fix? | Emitted from                                              |
| ------------------------------- | -------------------------------------- | ---- | --------------------------------------------------------- |
| `frameGraph.unknownWriteHandle` | Pass '…' writes undeclared handle '…'. | —    | `packages/webgpu/src/render/graph/frame-graph-compile.ts` |

## frameGraphExecute.compileNotOk (1)

| Code                             | Message                                                                  | Fix? | Emitted from                                              |
| -------------------------------- | ------------------------------------------------------------------------ | ---- | --------------------------------------------------------- |
| `frameGraphExecute.compileNotOk` | Cannot execute a frame graph that failed to compile (cyclic or invalid). | —    | `packages/webgpu/src/render/graph/frame-graph-execute.ts` |

## frameGraphExecute.encoderUnavailable (1)

| Code                                   | Message                                                 | Fix? | Emitted from                                              |
| -------------------------------------- | ------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `frameGraphExecute.encoderUnavailable` | WebGPU device did not produce a usable command encoder. | —    | `packages/webgpu/src/render/graph/frame-graph-execute.ts` |

## frameGraphExecute.missingComputePass (1)

| Code                                   | Message                                              | Fix? | Emitted from                                              |
| -------------------------------------- | ---------------------------------------------------- | ---- | --------------------------------------------------------- |
| `frameGraphExecute.missingComputePass` | Command encoder cannot begin a compute pass for '…'. | —    | `packages/webgpu/src/render/graph/frame-graph-execute.ts` |

## frameGraphExecute.unresolvedWrite (1)

| Code                                | Message                                                     | Fix? | Emitted from                                              |
| ----------------------------------- | ----------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `frameGraphExecute.unresolvedWrite` | Render pass '…' write handle '…' did not resolve to a view. | —    | `packages/webgpu/src/render/graph/frame-graph-execute.ts` |

## frameReadiness.emptyFrame (1)

| Code                        | Message                                                   | Fix? | Emitted from                                          |
| --------------------------- | --------------------------------------------------------- | ---- | ----------------------------------------------------- |
| `frameReadiness.emptyFrame` | Frame assembly has no draw packages ready for submission. | —    | `packages/webgpu/src/render/frame/frame-readiness.ts` |

## glb.chunkOutOfBounds (1)

| Code                   | Message                                                     | Fix? | Emitted from                                         |
| ---------------------- | ----------------------------------------------------------- | ---- | ---------------------------------------------------- |
| `glb.chunkOutOfBounds` | GLB chunk byte range exceeds the declared container length. | —    | `packages/render/src/assets/glb-container-chunks.ts` |

## glb.duplicateBinaryChunk (1)

| Code                       | Message                                 | Fix? | Emitted from                                         |
| -------------------------- | --------------------------------------- | ---- | ---------------------------------------------------- |
| `glb.duplicateBinaryChunk` | GLB must contain at most one BIN chunk. | —    | `packages/render/src/assets/glb-container-chunks.ts` |

## glb.duplicateJsonChunk (1)

| Code                     | Message                               | Fix? | Emitted from                                         |
| ------------------------ | ------------------------------------- | ---- | ---------------------------------------------------- |
| `glb.duplicateJsonChunk` | GLB must contain only one JSON chunk. | —    | `packages/render/src/assets/glb-container-chunks.ts` |

## glb.emptyJsonChunk (1)

| Code                 | Message                           | Fix? | Emitted from                                         |
| -------------------- | --------------------------------- | ---- | ---------------------------------------------------- |
| `glb.emptyJsonChunk` | GLB JSON chunk must not be empty. | —    | `packages/render/src/assets/glb-container-chunks.ts` |

## glb.invalidChunkHeader (1)

| Code                     | Message                        | Fix? | Emitted from                                         |
| ------------------------ | ------------------------------ | ---- | ---------------------------------------------------- |
| `glb.invalidChunkHeader` | GLB chunk header is truncated. | —    | `packages/render/src/assets/glb-container-chunks.ts` |

## glb.invalidJson (1)

| Code              | Message                             | Fix? | Emitted from                                  |
| ----------------- | ----------------------------------- | ---- | --------------------------------------------- |
| `glb.invalidJson` | GLB JSON chunk must be valid UTF-8. | —    | `packages/render/src/assets/glb-container.ts` |

## glb.invalidMagic (1)

| Code               | Message                    | Fix? | Emitted from                                  |
| ------------------ | -------------------------- | ---- | --------------------------------------------- |
| `glb.invalidMagic` | GLB JSON chunk is missing. | —    | `packages/render/src/assets/glb-container.ts` |

## glb.lengthMismatch (1)

| Code                 | Message                    | Fix? | Emitted from                                  |
| -------------------- | -------------------------- | ---- | --------------------------------------------- |
| `glb.lengthMismatch` | GLB JSON chunk is missing. | —    | `packages/render/src/assets/glb-container.ts` |

## glb.missingJsonChunk (1)

| Code                   | Message                                 | Fix? | Emitted from                                                                                          |
| ---------------------- | --------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| `glb.missingJsonChunk` | GLB first chunk must be the JSON chunk. | —    | `packages/render/src/assets/glb-container-chunks.ts`<br>`packages/render/src/assets/glb-container.ts` |

## glb.tooShort (1)

| Code           | Message                            | Fix? | Emitted from                                  |
| -------------- | ---------------------------------- | ---- | --------------------------------------------- |
| `glb.tooShort` | GLB data must be at least … bytes. | —    | `packages/render/src/assets/glb-container.ts` |

## glb.unknownChunk (1)

| Code               | Message                                                       | Fix? | Emitted from                                         |
| ------------------ | ------------------------------------------------------------- | ---- | ---------------------------------------------------- |
| `glb.unknownChunk` | GLB contains an unknown chunk type; preserving metadata only. | —    | `packages/render/src/assets/glb-container-chunks.ts` |

## glb.unsupportedVersion (1)

| Code                     | Message                    | Fix? | Emitted from                                  |
| ------------------------ | -------------------------- | ---- | --------------------------------------------- |
| `glb.unsupportedVersion` | GLB JSON chunk is missing. | —    | `packages/render/src/assets/glb-container.ts` |

## glbImport.externalBufferUnsupported (1)

| Code                                  | Message                                                          | Fix? | Emitted from                                                      |
| ------------------------------------- | ---------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `glbImport.externalBufferUnsupported` | GLB buffer 0 requires bytes, but the container has no BIN chunk. | —    | `packages/render/src/assets/gltf-report-driven-import-buffers.ts` |

## glbImport.missingBinaryChunk (1)

| Code                           | Message                                                          | Fix? | Emitted from                                                      |
| ------------------------------ | ---------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `glbImport.missingBinaryChunk` | GLB buffer 0 requires bytes, but the container has no BIN chunk. | —    | `packages/render/src/assets/gltf-report-driven-import-buffers.ts` |

## gltfAccessor.accessorRangeOutOfBounds (1)

| Code                                    | Message                                     | Fix? | Emitted from                                                       |
| --------------------------------------- | ------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `gltfAccessor.accessorRangeOutOfBounds` | Accessor … byte range exceeds bufferView …. | —    | `packages/render/src/assets/gltf-accessor-validation-accessors.ts` |

## gltfAccessor.bufferRangeOutOfBounds (1)

| Code                                  | Message                                   | Fix? | Emitted from                                                     |
| ------------------------------------- | ----------------------------------------- | ---- | ---------------------------------------------------------------- |
| `gltfAccessor.bufferRangeOutOfBounds` | bufferView … byte range exceeds buffer …. | —    | `packages/render/src/assets/gltf-accessor-validation-buffers.ts` |

## gltfAccessor.externalBufferUnresolved (1)

| Code                                    | Message                                                               | Fix? | Emitted from                                                     |
| --------------------------------------- | --------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `gltfAccessor.externalBufferUnresolved` | buffer … is external and has no caller-provided resolved byte length. | —    | `packages/render/src/assets/gltf-accessor-validation-buffers.ts` |

## gltfAccessor.invalidAccessor (1)

| Code                           | Message                                   | Fix? | Emitted from                                                       |
| ------------------------------ | ----------------------------------------- | ---- | ------------------------------------------------------------------ |
| `gltfAccessor.invalidAccessor` | Accessor … for … is missing or malformed. | —    | `packages/render/src/assets/gltf-accessor-validation-accessors.ts` |

## gltfAccessor.invalidBuffer (1)

| Code                         | Message                           | Fix? | Emitted from                                                     |
| ---------------------------- | --------------------------------- | ---- | ---------------------------------------------------------------- |
| `gltfAccessor.invalidBuffer` | buffer … is missing or malformed. | —    | `packages/render/src/assets/gltf-accessor-validation-buffers.ts` |

## gltfAccessor.invalidBufferView (1)

| Code                             | Message                               | Fix? | Emitted from                                                     |
| -------------------------------- | ------------------------------------- | ---- | ---------------------------------------------------------------- |
| `gltfAccessor.invalidBufferView` | bufferView … is missing or malformed. | —    | `packages/render/src/assets/gltf-accessor-validation-buffers.ts` |

## gltfAccessor.invalidByteStride (1)

| Code                             | Message                                                              | Fix? | Emitted from                                                       |
| -------------------------------- | -------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `gltfAccessor.invalidByteStride` | bufferView … byteStride is smaller than the … accessor element size. | —    | `packages/render/src/assets/gltf-accessor-validation-accessors.ts` |

## gltfAccessor.malformedAccessors (1)

| Code                              | Message                                              | Fix? | Emitted from                                             |
| --------------------------------- | ---------------------------------------------------- | ---- | -------------------------------------------------------- |
| `gltfAccessor.malformedAccessors` | glTF root must be an object for accessor validation. | —    | `packages/render/src/assets/gltf-accessor-validation.ts` |

## gltfAccessor.sparseAccessorDeferred (1)

| Code                                  | Message                                                                 | Fix? | Emitted from                                                       |
| ------------------------------------- | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `gltfAccessor.sparseAccessorDeferred` | Accessor … for … uses sparse data, which is deferred by this validator. | —    | `packages/render/src/assets/gltf-accessor-validation-accessors.ts` |

## gltfAccessor.zeroFillAccessorDeferred (1)

| Code                                    | Message                                                                                    | Fix? | Emitted from                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------ |
| `gltfAccessor.zeroFillAccessorDeferred` | Accessor … has no bufferView; zero-filled accessors are deferred for renderable mesh data. | —    | `packages/render/src/assets/gltf-accessor-validation-accessors.ts` |

## gltfAnimation.channelLengthMismatch (1)

| Code                                  | Message                                                                                 | Fix? | Emitted from                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------- |
| `gltfAnimation.channelLengthMismatch` | glTF animation … channel … weights output length is not a multiple of keyframeCount\*…. | —    | `packages/render/src/assets/gltf-animation-import.ts` |

## gltfAnimation.emptyClip (1)

| Code                      | Message                                         | Fix? | Emitted from                                          |
| ------------------------- | ----------------------------------------------- | ---- | ----------------------------------------------------- |
| `gltfAnimation.emptyClip` | glTF animation … produced no playable channels. | —    | `packages/render/src/assets/gltf-animation-import.ts` |

## gltfAnimation.inputDecodeFailed (1)

| Code                              | Message                                                                                  | Fix? | Emitted from                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------- |
| `gltfAnimation.inputDecodeFailed` | glTF animation … channel … input accessor … could not be decoded as a SCALAR time track. | —    | `packages/render/src/assets/gltf-animation-import.ts` |

## gltfAnimation.malformedAnimation (1)

| Code                               | Message                             | Fix? | Emitted from                                          |
| ---------------------------------- | ----------------------------------- | ---- | ----------------------------------------------------- |
| `gltfAnimation.malformedAnimation` | glTF animation … must be an object. | —    | `packages/render/src/assets/gltf-animation-import.ts` |

## gltfAnimation.malformedAnimations (1)

| Code                                | Message                                        | Fix? | Emitted from                                          |
| ----------------------------------- | ---------------------------------------------- | ---- | ----------------------------------------------------- |
| `gltfAnimation.malformedAnimations` | glTF animations must be an array when present. | —    | `packages/render/src/assets/gltf-animation-import.ts` |

## gltfAnimation.malformedChannel (1)

| Code                             | Message                                  | Fix? | Emitted from                                          |
| -------------------------------- | ---------------------------------------- | ---- | ----------------------------------------------------- |
| `gltfAnimation.malformedChannel` | glTF animation … channel … is malformed. | —    | `packages/render/src/assets/gltf-animation-import.ts` |

## gltfAnimation.missingSampler (1)

| Code                           | Message                                                   | Fix? | Emitted from                                          |
| ------------------------------ | --------------------------------------------------------- | ---- | ----------------------------------------------------- |
| `gltfAnimation.missingSampler` | glTF animation … channel … references an invalid sampler. | —    | `packages/render/src/assets/gltf-animation-import.ts` |

## gltfAnimation.missingTargetNode (1)

| Code                              | Message                                        | Fix? | Emitted from                                          |
| --------------------------------- | ---------------------------------------------- | ---- | ----------------------------------------------------- |
| `gltfAnimation.missingTargetNode` | glTF animation … channel … has no target node. | —    | `packages/render/src/assets/gltf-animation-import.ts` |

## gltfAnimation.outputDecodeFailed (1)

| Code                               | Message                                                            | Fix? | Emitted from                                          |
| ---------------------------------- | ------------------------------------------------------------------ | ---- | ----------------------------------------------------- |
| `gltfAnimation.outputDecodeFailed` | glTF animation … channel … output accessor … could not be decoded. | —    | `packages/render/src/assets/gltf-animation-import.ts` |

## gltfAnimation.unsupportedInterpolation (1)

| Code                                     | Message                                                       | Fix? | Emitted from                                          |
| ---------------------------------------- | ------------------------------------------------------------- | ---- | ----------------------------------------------------- |
| `gltfAnimation.unsupportedInterpolation` | glTF animation … channel … uses an unsupported interpolation. | —    | `packages/render/src/assets/gltf-animation-import.ts` |

## gltfAnimation.unsupportedTargetPath (1)

| Code                                  | Message                                                 | Fix? | Emitted from                                          |
| ------------------------------------- | ------------------------------------------------------- | ---- | ----------------------------------------------------- |
| `gltfAnimation.unsupportedTargetPath` | glTF animation … channel … targets an unsupported path. | —    | `packages/render/src/assets/gltf-animation-import.ts` |

## gltfDecode.missingBufferBytes (1)

| Code                            | Message                                 | Fix? | Emitted from                                           |
| ------------------------------- | --------------------------------------- | ---- | ------------------------------------------------------ |
| `gltfDecode.missingBufferBytes` | Buffer … bytes were not provided for …. | —    | `packages/render/src/assets/gltf-accessor-decoding.ts` |

## gltfDecode.sourceRangeOutOfBounds (1)

| Code                                | Message                                            | Fix? | Emitted from                                           |
| ----------------------------------- | -------------------------------------------------- | ---- | ------------------------------------------------------ |
| `gltfDecode.sourceRangeOutOfBounds` | Accessor … source range exceeds resolved buffer …. | —    | `packages/render/src/assets/gltf-accessor-decoding.ts` |

## gltfDecode.unsupportedOutputFormat (1)

| Code                                 | Message                                       | Fix? | Emitted from                                           |
| ------------------------------------ | --------------------------------------------- | ---- | ------------------------------------------------------ |
| `gltfDecode.unsupportedOutputFormat` | Accessor … has unsupported output format '…'. | —    | `packages/render/src/assets/gltf-accessor-decoding.ts` |

## gltfDracoDecode.failed (1)

| Code                     | Message                       | Fix? | Emitted from                                                    |
| ------------------------ | ----------------------------- | ---- | --------------------------------------------------------------- |
| `gltfDracoDecode.failed` | (message composed at runtime) | —    | `packages/render/src/assets/gltf-report-driven-import-draco.ts` |

## gltfDracoDecode.missingBufferBytes (1)

| Code                                 | Message                                                             | Fix? | Emitted from                                                    |
| ------------------------------------ | ------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `gltfDracoDecode.missingBufferBytes` | Draco bufferView … bytes were not available for mesh … primitive …. | —    | `packages/render/src/assets/gltf-report-driven-import-draco.ts` |

## gltfEcsAuthoring.duplicateEntityKey (1)

| Code                                  | Message                                    | Fix? | Emitted from                                                             |
| ------------------------------------- | ------------------------------------------ | ---- | ------------------------------------------------------------------------ |
| `gltfEcsAuthoring.duplicateEntityKey` | Entity key '…' was planned more than once. | —    | `packages/render/src/assets/gltf-ecs-authoring-command-plan-entities.ts` |

## gltfEcsAuthoring.invalidTraversalReport (1)

| Code                                      | Message                                                                    | Fix? | Emitted from                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `gltfEcsAuthoring.invalidTraversalReport` | No ECS authoring commands were planned because scene traversal is invalid. | —    | `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts` |

## gltfEcsAuthoring.missingPrimitiveMaterialResolution (1)

| Code                                                  | Message                                                                                      | Fix? | Emitted from                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `gltfEcsAuthoring.missingPrimitiveMaterialResolution` | Node '…' references glTF mesh …, but no primitive material resolution entries were provided. | —    | `packages/render/src/assets/gltf-ecs-authoring-command-plan-primitive-skips.ts` |

## gltfEcsAuthoring.missingSceneRoot (1)

| Code                                | Message                                                                               | Fix? | Emitted from                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `gltfEcsAuthoring.missingSceneRoot` | No ECS authoring commands were planned because traversal did not select a scene root. | —    | `packages/render/src/assets/gltf-ecs-authoring-command-plan.ts` |

## gltfEcsAuthoring.nodeSkippedByAncestor (1)

| Code                                     | Message                                                    | Fix? | Emitted from                                                             |
| ---------------------------------------- | ---------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `gltfEcsAuthoring.nodeSkippedByAncestor` | Node '…' was skipped because an ancestor node was skipped. | —    | `packages/render/src/assets/gltf-ecs-authoring-command-plan-entities.ts` |

## gltfEcsAuthoring.skinJointNodeMissing (1)

| Code                                    | Message                                                       | Fix? | Emitted from                                                               |
| --------------------------------------- | ------------------------------------------------------------- | ---- | -------------------------------------------------------------------------- |
| `gltfEcsAuthoring.skinJointNodeMissing` | glTF skin … joint node … was not produced by scene traversal. | —    | `packages/render/src/assets/gltf-ecs-authoring-command-plan-primitives.ts` |

## gltfEcsAuthoring.unresolvedPrimitiveMaterial (1)

| Code                                           | Message                                                           | Fix? | Emitted from                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `gltfEcsAuthoring.unresolvedPrimitiveMaterial` | Primitive '…' was not planned because material resolution failed. | —    | `packages/render/src/assets/gltf-ecs-authoring-command-plan-primitive-skips.ts` |

## gltfEcsReplay.componentApplyFailed (1)

| Code                                 | Message                       | Fix? | Emitted from                                                       |
| ------------------------------------ | ----------------------------- | ---- | ------------------------------------------------------------------ |
| `gltfEcsReplay.componentApplyFailed` | (message composed at runtime) | —    | `packages/render/src/assets/gltf-ecs-command-replay-components.ts` |

## gltfEcsReplay.duplicateEntityKey (1)

| Code                               | Message                                    | Fix? | Emitted from                                            |
| ---------------------------------- | ------------------------------------------ | ---- | ------------------------------------------------------- |
| `gltfEcsReplay.duplicateEntityKey` | Entity key '…' was created more than once. | —    | `packages/render/src/assets/gltf-ecs-command-replay.ts` |

## gltfEcsReplay.invalidComponentValue (1)

| Code                                  | Message                       | Fix? | Emitted from                                                        |
| ------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------------------- |
| `gltfEcsReplay.invalidComponentValue` | (message composed at runtime) | —    | `packages/render/src/assets/gltf-ecs-command-replay-diagnostics.ts` |

## gltfEcsReplay.invalidPlan (1)

| Code                        | Message                                                                           | Fix? | Emitted from                                            |
| --------------------------- | --------------------------------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `gltfEcsReplay.invalidPlan` | GLB ECS authoring commands were not replayed because the command plan is invalid. | —    | `packages/render/src/assets/gltf-ecs-command-replay.ts` |

## gltfEcsReplay.missingEntityKey (1)

| Code                             | Message                                                               | Fix? | Emitted from                                            |
| -------------------------------- | --------------------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `gltfEcsReplay.missingEntityKey` | Component '…' was not applied because entity key '…' was not created. | —    | `packages/render/src/assets/gltf-ecs-command-replay.ts` |

## gltfEcsReplay.missingJointEntityKey (1)

| Code                                  | Message                                      | Fix? | Emitted from                                                       |
| ------------------------------------- | -------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `gltfEcsReplay.missingJointEntityKey` | Skin joint '…' was not found for entity '…'. | —    | `packages/render/src/assets/gltf-ecs-command-replay-components.ts` |

## gltfEcsReplay.missingParentEntityKey (1)

| Code                                   | Message                                  | Fix? | Emitted from                                                       |
| -------------------------------------- | ---------------------------------------- | ---- | ------------------------------------------------------------------ |
| `gltfEcsReplay.missingParentEntityKey` | Parent '…' was not found for entity '…'. | —    | `packages/render/src/assets/gltf-ecs-command-replay-components.ts` |

## gltfEcsReplay.unknownComponent (1)

| Code                             | Message                                           | Fix? | Emitted from                                                       |
| -------------------------------- | ------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `gltfEcsReplay.unknownComponent` | Component '…' is not supported by GLB ECS replay. | —    | `packages/render/src/assets/gltf-ecs-command-replay-components.ts` |

## gltfImport.assetMappingConflict (1)

| Code                              | Message                                                                                   | Fix? | Emitted from                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `gltfImport.assetMappingConflict` | Report-driven import cannot accept provided.assetMapping when createAssetMapping is true. | —    | `packages/render/src/assets/gltf-report-driven-import.ts` |

## gltfImport.meshConstructionConflict (1)

| Code                                  | Message                                                                                     | Fix? | Emitted from                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `gltfImport.meshConstructionConflict` | Report-driven import cannot accept provided.meshConstruction when createMeshAssets is true. | —    | `packages/render/src/assets/gltf-report-driven-import.ts` |

## gltfImport.providedRootReport (1)

| Code                            | Message                                                                                     | Fix? | Emitted from                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `gltfImport.providedRootReport` | Report-driven import creates its own root validation report; provided.root is not accepted. | —    | `packages/render/src/assets/gltf-report-driven-import.ts` |

## gltfImport.providedSceneTraversalReport (1)

| Code                                      | Message                                                                                               | Fix? | Emitted from                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `gltfImport.providedSceneTraversalReport` | Report-driven import creates its own scene traversal report; provided.sceneTraversal is not accepted. | —    | `packages/render/src/assets/gltf-report-driven-import.ts` |

## gltfLoader.failedStage (1)

| Code                     | Message                                             | Fix? | Emitted from                                              |
| ------------------------ | --------------------------------------------------- | ---- | --------------------------------------------------------- |
| `gltfLoader.failedStage` | GLB loader orchestration includes failed stage '…'. | —    | `packages/render/src/assets/gltf-loader-orchestration.ts` |

## gltfLoader.invalidStageOrder (1)

| Code                           | Message                                                                              | Fix? | Emitted from                                              |
| ------------------------------ | ------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------- |
| `gltfLoader.invalidStageOrder` | GLB loader orchestration includes side-effect stage '…' after failed pure stage '…'. | —    | `packages/render/src/assets/gltf-loader-orchestration.ts` |

## gltfLoader.sideEffectWithoutPrerequisite (1)

| Code                                       | Message                                                         | Fix? | Emitted from                                              |
| ------------------------------------------ | --------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `gltfLoader.sideEffectWithoutPrerequisite` | GLB loader orchestration includes '…' without prerequisite '…'. | —    | `packages/render/src/assets/gltf-loader-orchestration.ts` |

## gltfMaterial.invalidField (1)

| Code                        | Message                                   | Fix? | Emitted from                                                                                                                                                                                                                                                      |
| --------------------------- | ----------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gltfMaterial.invalidField` | alphaMode must be OPAQUE, MASK, or BLEND. | —    | `packages/render/src/materials/gltf-material-render-state.ts`<br>`packages/render/src/materials/gltf-material-scalars.ts`<br>`packages/render/src/materials/gltf-material-standard-extension-fields.ts`<br>`packages/render/src/materials/gltf-material-utils.ts` |

## gltfMaterial.invalidTextureInfo (1)

| Code                              | Message                               | Fix? | Emitted from                                                                                                                        |
| --------------------------------- | ------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `gltfMaterial.invalidTextureInfo` | … must be a glTF texture info object. | —    | `packages/render/src/materials/gltf-material-texture-info.ts`<br>`packages/render/src/materials/gltf-material-texture-transform.ts` |

## gltfMaterial.malformedMaterial (1)

| Code                             | Message                          | Fix? | Emitted from                                     |
| -------------------------------- | -------------------------------- | ---- | ------------------------------------------------ |
| `gltfMaterial.malformedMaterial` | glTF material must be an object. | —    | `packages/render/src/materials/gltf-material.ts` |

## gltfMaterial.unresolvedTextureBinding (1)

| Code                                    | Message                                                 | Fix? | Emitted from                                                      |
| --------------------------------------- | ------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `gltfMaterial.unresolvedTextureBinding` | … could not be resolved to texture and sampler handles. | —    | `packages/render/src/materials/gltf-material-texture-resolver.ts` |

## gltfMaterial.unsupportedOptionalExtension (1)

| Code                                        | Message                                                                                                                      | Fix? | Emitted from                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `gltfMaterial.unsupportedOptionalExtension` | ….… is preserved in source data but current clearcoat rendering only samples clearcoatTexture and clearcoatRoughnessTexture. | —    | `packages/render/src/materials/gltf-material-extensions.ts` |

## gltfMaterial.unsupportedTextureTransform (1)

| Code                                       | Message                                                                                                                                                                              | Fix? | Emitted from                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------ |
| `gltfMaterial.unsupportedTextureTransform` | … is preserved, but only base-color, metallic-roughness, clearcoat, normal, occlusion, and emissive transforms on TEXCOORD_0 or TEXCOORD_1 are rendered by current material shaders. | —    | `packages/render/src/materials/gltf-material-texture-transform.ts` |

## gltfMaterial.unsupportedUnlitField (1)

| Code                                 | Message                                                                       | Fix? | Emitted from                                                |
| ------------------------------------ | ----------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `gltfMaterial.unsupportedUnlitField` | … is present on a KHR_materials_unlit material and will not affect rendering. | —    | `packages/render/src/materials/gltf-material-extensions.ts` |

## gltfMesh.invalidAccessorReference (1)

| Code                                | Message                                                      | Fix? | Emitted from                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `gltfMesh.invalidAccessorReference` | glTF mesh … primitive … has an invalid … accessor reference. | —    | `packages/render/src/assets/gltf-mesh-primitive-accessor-reference.ts`<br>`packages/render/src/assets/gltf-mesh-primitive-indices.ts` |

## gltfMesh.invalidCompressedPrimitive (1)

| Code                                  | Message                                                                              | Fix? | Emitted from                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------- |
| `gltfMesh.invalidCompressedPrimitive` | glTF mesh … primitive … has a malformed KHR_draco_mesh_compression extension object. | —    | `packages/render/src/assets/gltf-mesh-primitive-compression.ts` |

## gltfMesh.malformedMeshes (1)

| Code                       | Message                                    | Fix? | Emitted from                                        |
| -------------------------- | ------------------------------------------ | ---- | --------------------------------------------------- |
| `gltfMesh.malformedMeshes` | glTF meshes must be an array when present. | —    | `packages/render/src/assets/gltf-mesh-primitive.ts` |

## gltfMesh.malformedPrimitive (1)

| Code                          | Message                                    | Fix? | Emitted from                                                  |
| ----------------------------- | ------------------------------------------ | ---- | ------------------------------------------------------------- |
| `gltfMesh.malformedPrimitive` | glTF mesh … primitive … must be an object. | —    | `packages/render/src/assets/gltf-mesh-primitive-selection.ts` |

## gltfMesh.malformedPrimitives (1)

| Code                           | Message                                      | Fix? | Emitted from                                                  |
| ------------------------------ | -------------------------------------------- | ---- | ------------------------------------------------------------- |
| `gltfMesh.malformedPrimitives` | glTF mesh … must include a primitives array. | —    | `packages/render/src/assets/gltf-mesh-primitive-selection.ts` |

## gltfMesh.missingMesh (1)

| Code                   | Message                                         | Fix? | Emitted from                                                  |
| ---------------------- | ----------------------------------------------- | ---- | ------------------------------------------------------------- |
| `gltfMesh.missingMesh` | glTF mesh … does not exist or is not an object. | —    | `packages/render/src/assets/gltf-mesh-primitive-selection.ts` |

## gltfMesh.missingPosition (1)

| Code                       | Message                                                    | Fix? | Emitted from                                                                                                                             |
| -------------------------- | ---------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `gltfMesh.missingPosition` | glTF mesh … primitive … must include a POSITION attribute. | —    | `packages/render/src/assets/gltf-mesh-primitive-accessor-reference.ts`<br>`packages/render/src/assets/gltf-mesh-primitive-attributes.ts` |

## gltfMesh.missingPrimitive (1)

| Code                        | Message                                 | Fix? | Emitted from                                                  |
| --------------------------- | --------------------------------------- | ---- | ------------------------------------------------------------- |
| `gltfMesh.missingPrimitive` | glTF mesh … primitive … does not exist. | —    | `packages/render/src/assets/gltf-mesh-primitive-selection.ts` |

## gltfMesh.unresolvedAccessorData (1)

| Code                              | Message                                                                                                          | Fix? | Emitted from                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `gltfMesh.unresolvedAccessorData` | glTF mesh … primitive … references accessors that have not been decoded; planned mesh source asset remains null. | —    | `packages/render/src/assets/gltf-mesh-primitive-planning.ts` |

## gltfMesh.unsupportedCompressedPrimitive (1)

| Code                                      | Message                                                                      | Fix? | Emitted from                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `gltfMesh.unsupportedCompressedPrimitive` | glTF mesh … primitive … uses unsupported compressed primitive extension '…'. | —    | `packages/render/src/assets/gltf-mesh-primitive-compression.ts` |

## gltfMesh.unsupportedPrimitiveMode (1)

| Code                                | Message                                                                                                                                      | Fix? | Emitted from                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `gltfMesh.unsupportedPrimitiveMode` | glTF mesh … primitive … uses unsupported primitive mode '…'; only TRIANGLES mode 4 is rendered by this mapper, so this primitive is skipped. | —    | `packages/render/src/assets/gltf-mesh-primitive-planning.ts` |

## gltfMeshoptDecode.decoderRequired (1)

| Code                                | Message                                                     | Fix? | Emitted from                                                      |
| ----------------------------------- | ----------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `gltfMeshoptDecode.decoderRequired` | Meshopt-compressed bufferView … requires a Meshopt decoder. | —    | `packages/render/src/assets/gltf-report-driven-import-meshopt.ts` |

## gltfMeshoptDecode.failed (1)

| Code                       | Message                       | Fix? | Emitted from                                                      |
| -------------------------- | ----------------------------- | ---- | ----------------------------------------------------------------- |
| `gltfMeshoptDecode.failed` | (message composed at runtime) | —    | `packages/render/src/assets/gltf-report-driven-import-meshopt.ts` |

## gltfMeshoptDecode.malformedExtension (1)

| Code                                   | Message                                                                | Fix? | Emitted from                                                      |
| -------------------------------------- | ---------------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `gltfMeshoptDecode.malformedExtension` | Meshopt-compressed bufferView … has a malformed compression extension. | —    | `packages/render/src/assets/gltf-report-driven-import-meshopt.ts` |

## gltfMeshoptDecode.missingBufferBytes (1)

| Code                                   | Message                                                          | Fix? | Emitted from                                                      |
| -------------------------------------- | ---------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `gltfMeshoptDecode.missingBufferBytes` | Meshopt-compressed bufferView … source bytes were not available. | —    | `packages/render/src/assets/gltf-report-driven-import-meshopt.ts` |

## gltfMeshRegistration.duplicateAssetKey (1)

| Code                                     | Message                                          | Fix? | Emitted from                                                          |
| ---------------------------------------- | ------------------------------------------------ | ---- | --------------------------------------------------------------------- |
| `gltfMeshRegistration.duplicateAssetKey` | Mesh '…' already exists and was not overwritten. | —    | `packages/render/src/assets/gltf-mesh-source-registration-writers.ts` |

## gltfMeshRegistration.invalidConstructionReport (1)

| Code                                             | Message                                                                           | Fix? | Emitted from                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `gltfMeshRegistration.invalidConstructionReport` | No mesh source assets were registered because the construction report is invalid. | —    | `packages/render/src/assets/gltf-mesh-source-registration.ts` |

## gltfMeshRegistration.invalidHandleKey (1)

| Code                                    | Message                                                                | Fix? | Emitted from                                                          |
| --------------------------------------- | ---------------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `gltfMeshRegistration.invalidHandleKey` | Mesh '…' was not registered because its planned handle key is invalid. | —    | `packages/render/src/assets/gltf-mesh-source-registration-writers.ts` |

## gltfMeshRegistration.invalidPlannedAsset (1)

| Code                                       | Message                                                                  | Fix? | Emitted from                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------- |
| `gltfMeshRegistration.invalidPlannedAsset` | Mesh '…' was not registered because its planned source asset is invalid. | —    | `packages/render/src/assets/gltf-mesh-source-registration-writers.ts` |

## gltfMorph.malformedMeshes (1)

| Code                        | Message                                    | Fix? | Emitted from                                             |
| --------------------------- | ------------------------------------------ | ---- | -------------------------------------------------------- |
| `gltfMorph.malformedMeshes` | glTF meshes must be an array when present. | —    | `packages/render/src/assets/gltf-morph-target-import.ts` |

## gltfMorph.malformedTarget (1)

| Code                        | Message                                             | Fix? | Emitted from                                             |
| --------------------------- | --------------------------------------------------- | ---- | -------------------------------------------------------- |
| `gltfMorph.malformedTarget` | glTF mesh … primitive … target … must be an object. | —    | `packages/render/src/assets/gltf-morph-target-import.ts` |

## gltfMorph.positionDecodeFailed (1)

| Code                             | Message                                             | Fix? | Emitted from                                             |
| -------------------------------- | --------------------------------------------------- | ---- | -------------------------------------------------------- |
| `gltfMorph.positionDecodeFailed` | glTF morph target … is missing a POSITION accessor. | —    | `packages/render/src/assets/gltf-morph-target-import.ts` |

## gltfMorph.vertexCountMismatch (1)

| Code                            | Message                                         | Fix? | Emitted from                                             |
| ------------------------------- | ----------------------------------------------- | ---- | -------------------------------------------------------- |
| `gltfMorph.vertexCountMismatch` | glTF morph target … has … vertices, expected …. | —    | `packages/render/src/assets/gltf-morph-target-import.ts` |

## gltfRegistration.duplicateAssetKey (1)

| Code                                 | Message                                           | Fix? | Emitted from                                                   |
| ------------------------------------ | ------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `gltfRegistration.duplicateAssetKey` | Asset '…' already exists and was not overwritten. | —    | `packages/render/src/assets/gltf-source-registration-skips.ts` |

## gltfRegistration.invalidPlannedAsset (1)

| Code                                   | Message                                                                     | Fix? | Emitted from                                                     |
| -------------------------------------- | --------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `gltfRegistration.invalidPlannedAsset` | Texture '…' was not registered because its planned source asset is invalid. | —    | `packages/render/src/assets/gltf-source-registration-writers.ts` |

## gltfRegistration.missingDependency (1)

| Code                                 | Message                                                            | Fix? | Emitted from                                                     |
| ------------------------------------ | ------------------------------------------------------------------ | ---- | ---------------------------------------------------------------- |
| `gltfRegistration.missingDependency` | Material '…' was not registered because dependency '…' is missing. | —    | `packages/render/src/assets/gltf-source-registration-writers.ts` |

## gltfRegistration.rootInvalid (1)

| Code                           | Message                                                          | Fix? | Emitted from                                                   |
| ------------------------------ | ---------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `gltfRegistration.rootInvalid` | Texture '…' was not registered because the glTF root is invalid. | —    | `packages/render/src/assets/gltf-source-registration-skips.ts` |

## gltfRoot.invalidAsset (1)

| Code                    | Message                                 | Fix? | Emitted from                              |
| ----------------------- | --------------------------------------- | ---- | ----------------------------------------- |
| `gltfRoot.invalidAsset` | glTF root must include an asset object. | —    | `packages/render/src/assets/gltf-root.ts` |

## gltfRoot.malformedArray (1)

| Code                      | Message                                           | Fix? | Emitted from                              |
| ------------------------- | ------------------------------------------------- | ---- | ----------------------------------------- |
| `gltfRoot.malformedArray` | extensionsRequired must be an array when present. | —    | `packages/render/src/assets/gltf-root.ts` |

## gltfRoot.malformedRoot (1)

| Code                     | Message                      | Fix? | Emitted from                              |
| ------------------------ | ---------------------------- | ---- | ----------------------------------------- |
| `gltfRoot.malformedRoot` | glTF root must be an object. | —    | `packages/render/src/assets/gltf-root.ts` |

## gltfRoot.unsupportedRequiredExtension (1)

| Code                                    | Message                       | Fix? | Emitted from                              |
| --------------------------------------- | ----------------------------- | ---- | ----------------------------------------- |
| `gltfRoot.unsupportedRequiredExtension` | (message composed at runtime) | —    | `packages/render/src/assets/gltf-root.ts` |

## gltfRoot.unsupportedVersion (1)

| Code                          | Message                                                | Fix? | Emitted from                              |
| ----------------------------- | ------------------------------------------------------ | ---- | ----------------------------------------- |
| `gltfRoot.unsupportedVersion` | Only glTF 2.0 roots are supported by the asset mapper. | —    | `packages/render/src/assets/gltf-root.ts` |

## gltfSampler.invalidMagFilter (1)

| Code                           | Message                              | Fix? | Emitted from                                            |
| ------------------------------ | ------------------------------------ | ---- | ------------------------------------------------------- |
| `gltfSampler.invalidMagFilter` | magFilter must be NEAREST or LINEAR. | —    | `packages/render/src/materials/gltf-sampler-mapping.ts` |

## gltfSampler.invalidMinFilter (1)

| Code                           | Message                                             | Fix? | Emitted from                                            |
| ------------------------------ | --------------------------------------------------- | ---- | ------------------------------------------------------- |
| `gltfSampler.invalidMinFilter` | minFilter must be a glTF sampler filter enum value. | —    | `packages/render/src/materials/gltf-sampler-mapping.ts` |

## gltfSampler.invalidWrapMode (1)

| Code                          | Message                              | Fix? | Emitted from                                            |
| ----------------------------- | ------------------------------------ | ---- | ------------------------------------------------------- |
| `gltfSampler.invalidWrapMode` | magFilter must be NEAREST or LINEAR. | —    | `packages/render/src/materials/gltf-sampler-mapping.ts` |

## gltfScene.invalidNodeIndex (1)

| Code                         | Message                                      | Fix? | Emitted from                                                                                                       |
| ---------------------------- | -------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| `gltfScene.invalidNodeIndex` | glTF node … references invalid child node …. | —    | `packages/render/src/assets/gltf-scene-traversal-nodes.ts`<br>`packages/render/src/assets/gltf-scene-traversal.ts` |

## gltfScene.invalidSceneIndex (1)

| Code                          | Message                                                      | Fix? | Emitted from                                                   |
| ----------------------------- | ------------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `gltfScene.invalidSceneIndex` | No deterministic glTF scene could be selected for traversal. | —    | `packages/render/src/assets/gltf-scene-traversal-selection.ts` |

## gltfScene.malformedChildren (1)

| Code                          | Message                                             | Fix? | Emitted from                                               |
| ----------------------------- | --------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `gltfScene.malformedChildren` | glTF node … children must be an array when present. | —    | `packages/render/src/assets/gltf-scene-traversal-nodes.ts` |

## gltfScene.malformedNode (1)

| Code                      | Message                        | Fix? | Emitted from                                               |
| ------------------------- | ------------------------------ | ---- | ---------------------------------------------------------- |
| `gltfScene.malformedNode` | glTF node … must be an object. | —    | `packages/render/src/assets/gltf-scene-traversal-nodes.ts` |

## gltfScene.malformedNodes (1)

| Code                       | Message                                          | Fix? | Emitted from                                                   |
| -------------------------- | ------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `gltfScene.malformedNodes` | glTF nodes must be an array for scene traversal. | —    | `packages/render/src/assets/gltf-scene-traversal-selection.ts` |

## gltfScene.malformedScene (1)

| Code                       | Message                         | Fix? | Emitted from                                                   |
| -------------------------- | ------------------------------- | ---- | -------------------------------------------------------------- |
| `gltfScene.malformedScene` | glTF scene … must be an object. | —    | `packages/render/src/assets/gltf-scene-traversal-selection.ts` |

## gltfScene.malformedSceneNodes (1)

| Code                            | Message                                          | Fix? | Emitted from                                                   |
| ------------------------------- | ------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `gltfScene.malformedSceneNodes` | glTF nodes must be an array for scene traversal. | —    | `packages/render/src/assets/gltf-scene-traversal-selection.ts` |

## gltfScene.malformedScenes (1)

| Code                        | Message                                           | Fix? | Emitted from                                                   |
| --------------------------- | ------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `gltfScene.malformedScenes` | glTF scenes must be an array for scene traversal. | —    | `packages/render/src/assets/gltf-scene-traversal-selection.ts` |

## gltfScene.malformedTransform (1)

| Code                           | Message                                                 | Fix? | Emitted from                                                    |
| ------------------------------ | ------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `gltfScene.malformedTransform` | glTF node … cannot mix matrix and TRS transform fields. | —    | `packages/render/src/assets/gltf-scene-traversal-transforms.ts` |

## gltfScene.nodeCycle (1)

| Code                  | Message                                | Fix? | Emitted from                                               |
| --------------------- | -------------------------------------- | ---- | ---------------------------------------------------------- |
| `gltfScene.nodeCycle` | glTF scene … contains a node cycle: …. | —    | `packages/render/src/assets/gltf-scene-traversal-nodes.ts` |

## gltfScene.nodeMultipleParents (1)

| Code                            | Message                                               | Fix? | Emitted from                                               |
| ------------------------------- | ----------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `gltfScene.nodeMultipleParents` | glTF node … has multiple parents in selected scene …. | —    | `packages/render/src/assets/gltf-scene-traversal-nodes.ts` |

## gltfScene.unsupportedMatrixDecomposition (1)

| Code                                       | Message                                                             | Fix? | Emitted from                                                    |
| ------------------------------------------ | ------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `gltfScene.unsupportedMatrixDecomposition` | glTF node … matrix must be decomposable to an affine TRS transform. | —    | `packages/render/src/assets/gltf-scene-traversal-transforms.ts` |

## gltfSceneImport.insufficientMaterialFamilies (1)

| Code                                           | Message                                                                     | Fix? | Emitted from                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.insufficientMaterialFamilies` | GLTF scene vertical slice requires at least two built-in material families. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSceneImport.insufficientPrimitiveShapes (1)

| Code                                          | Message                                                                             | Fix? | Emitted from                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.insufficientPrimitiveShapes` | GLTF scene vertical slice requires at least three distinct primitive shape intents. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSceneImport.invalidAssetMapping (1)

| Code                                  | Message                                                           | Fix? | Emitted from                                                           |
| ------------------------------------- | ----------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.invalidAssetMapping` | GLTF scene import contract requires a valid asset mapping report. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSceneImport.invalidEcsCommandPlan (1)

| Code                                    | Message                                                                 | Fix? | Emitted from                                                           |
| --------------------------------------- | ----------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.invalidEcsCommandPlan` | GLTF scene import contract requires a valid ECS authoring command plan. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSceneImport.invalidMeshPrimitiveMapping (1)

| Code                                          | Message                                                                    | Fix? | Emitted from                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.invalidMeshPrimitiveMapping` | GLTF scene import contract requires a valid mesh primitive mapping report. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSceneImport.invalidPrimitiveMaterialResolution (1)

| Code                                                 | Message                                                                           | Fix? | Emitted from                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.invalidPrimitiveMaterialResolution` | GLTF scene import contract requires all primitive material references to resolve. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSceneImport.invalidSceneTraversal (1)

| Code                                    | Message                                                             | Fix? | Emitted from                                                           |
| --------------------------------------- | ------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.invalidSceneTraversal` | GLTF scene import contract requires a valid scene traversal report. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSceneImport.missingCameraIntent (1)

| Code                                  | Message                                                        | Fix? | Emitted from                                                           |
| ------------------------------------- | -------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.missingCameraIntent` | GLTF scene vertical slice requires at least one camera intent. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSceneImport.missingDirectLightIntent (1)

| Code                                       | Message                                                              | Fix? | Emitted from                                                           |
| ------------------------------------------ | -------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.missingDirectLightIntent` | GLTF scene vertical slice requires at least one direct-light intent. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSceneImport.missingEnvironmentIntent (1)

| Code                                       | Message                                                             | Fix? | Emitted from                                                           |
| ------------------------------------------ | ------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.missingEnvironmentIntent` | GLTF scene vertical slice requires environment/IBL intent metadata. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSceneImport.missingMeshRegistration (1)

| Code                                      | Message                                                                                            | Fix? | Emitted from                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.missingMeshRegistration` | GLTF scene import contract requires mesh asset registration before ECS authoring command planning. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSceneImport.missingShadowIntent (1)

| Code                                  | Message                                                        | Fix? | Emitted from                                                           |
| ------------------------------------- | -------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.missingShadowIntent` | GLTF scene vertical slice requires at least one shadow intent. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSceneImport.missingSourceRegistration (1)

| Code                                        | Message                                                                                             | Fix? | Emitted from                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSceneImport.missingSourceRegistration` | GLTF scene import contract requires source asset registration before primitive material resolution. | —    | `packages/render/src/assets/gltf-scene-import-contract-diagnostics.ts` |

## gltfSkin.invalidJointIndex (1)

| Code                         | Message                                              | Fix? | Emitted from                                     |
| ---------------------------- | ---------------------------------------------------- | ---- | ------------------------------------------------ |
| `gltfSkin.invalidJointIndex` | glTF skin … has an invalid joint node reference '…'. | —    | `packages/render/src/assets/gltf-skin-import.ts` |

## gltfSkin.inverseBindCountMismatch (1)

| Code                                | Message                                                                                         | Fix? | Emitted from                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| `gltfSkin.inverseBindCountMismatch` | glTF skin … provides … inverse-bind matrices for … joints; missing entries default to identity. | —    | `packages/render/src/assets/gltf-skin-import.ts` |

## gltfSkin.inverseBindDecodeFailed (1)

| Code                               | Message                                                                    | Fix? | Emitted from                                     |
| ---------------------------------- | -------------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| `gltfSkin.inverseBindDecodeFailed` | glTF skin … inverse-bind matrices accessor … could not be decoded as MAT4. | —    | `packages/render/src/assets/gltf-skin-import.ts` |

## gltfSkin.malformedSkin (1)

| Code                     | Message                        | Fix? | Emitted from                                     |
| ------------------------ | ------------------------------ | ---- | ------------------------------------------------ |
| `gltfSkin.malformedSkin` | glTF skin … must be an object. | —    | `packages/render/src/assets/gltf-skin-import.ts` |

## gltfSkin.malformedSkins (1)

| Code                      | Message                                   | Fix? | Emitted from                                     |
| ------------------------- | ----------------------------------------- | ---- | ------------------------------------------------ |
| `gltfSkin.malformedSkins` | glTF skins must be an array when present. | —    | `packages/render/src/assets/gltf-skin-import.ts` |

## gltfSkin.missingJoints (1)

| Code                     | Message                                            | Fix? | Emitted from                                     |
| ------------------------ | -------------------------------------------------- | ---- | ------------------------------------------------ |
| `gltfSkin.missingJoints` | glTF skin … must declare a non-empty joints array. | —    | `packages/render/src/assets/gltf-skin-import.ts` |

## gltfSourceRegistration.failedStage (1)

| Code                                 | Message                                   | Fix? | Emitted from                                                           |
| ------------------------------------ | ----------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSourceRegistration.failedStage` | GLB source registration stage '…' failed. | —    | `packages/render/src/assets/gltf-source-registration-orchestration.ts` |

## gltfSourceRegistration.missingInput (1)

| Code                                  | Message                                                                                 | Fix? | Emitted from                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `gltfSourceRegistration.missingInput` | GLB source registration requires an asset mapping report or a mesh construction report. | —    | `packages/render/src/assets/gltf-source-registration-orchestration.ts` |

## gltfTexture.imageResolverFailed (1)

| Code                              | Message                                                                                                              | Fix? | Emitted from                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `gltfTexture.imageResolverFailed` | Image data resolver returned a Promise; use createTextureAssetFromGltfTextureAsync() for async glTF texture mapping. | —    | `packages/render/src/materials/gltf-texture-resolution.ts` |

## gltfTexture.invalidDecodedImage (1)

| Code                              | Message                                                            | Fix? | Emitted from                                               |
| --------------------------------- | ------------------------------------------------------------------ | ---- | ---------------------------------------------------------- |
| `gltfTexture.invalidDecodedImage` | Decoded image data must include dimensions, row stride, and bytes. | —    | `packages/render/src/materials/gltf-texture-resolution.ts` |

## gltfTexture.invalidSampler (1)

| Code                         | Message                       | Fix? | Emitted from                                                    |
| ---------------------------- | ----------------------------- | ---- | --------------------------------------------------------------- |
| `gltfTexture.invalidSampler` | (message composed at runtime) | —    | `packages/render/src/materials/gltf-texture-sampler-mapping.ts` |

## gltfTexture.invalidSamplerIndex (1)

| Code                              | Message                                                 | Fix? | Emitted from                                                    |
| --------------------------------- | ------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `gltfTexture.invalidSamplerIndex` | textures[…].sampler must reference an existing sampler. | —    | `packages/render/src/materials/gltf-texture-sampler-mapping.ts` |

## gltfTexture.invalidTextureSource (1)

| Code                               | Message                                                                              | Fix? | Emitted from                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `gltfTexture.invalidTextureSource` | textures[…].extensions.KHR_texture_basisu.source must be a non-negative image index. | —    | `packages/render/src/materials/gltf-texture-source-mapping.ts` |

## gltfTexture.malformedImage (1)

| Code                         | Message                      | Fix? | Emitted from                                            |
| ---------------------------- | ---------------------------- | ---- | ------------------------------------------------------- |
| `gltfTexture.malformedImage` | images[…] must be an object. | —    | `packages/render/src/materials/gltf-texture-prepare.ts` |

## gltfTexture.malformedTexture (1)

| Code                           | Message                                      | Fix? | Emitted from                                            |
| ------------------------------ | -------------------------------------------- | ---- | ------------------------------------------------------- |
| `gltfTexture.malformedTexture` | textureIndex must be a non-negative integer. | —    | `packages/render/src/materials/gltf-texture-prepare.ts` |

## gltfTexture.missingImageSource (1)

| Code                             | Message                                     | Fix? | Emitted from                                                   |
| -------------------------------- | ------------------------------------------- | ---- | -------------------------------------------------------------- |
| `gltfTexture.missingImageSource` | BufferView images must declare a MIME type. | —    | `packages/render/src/materials/gltf-texture-source-mapping.ts` |

## gltfTexture.unsupportedImageMimeType (1)

| Code                                   | Message                                                     | Fix? | Emitted from                                                   |
| -------------------------------------- | ----------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `gltfTexture.unsupportedImageMimeType` | Image MIME type '…' is not supported by the minimal mapper. | —    | `packages/render/src/materials/gltf-texture-source-mapping.ts` |

## gpuOcclusion.commandEncodingUnsupported (1)

| Code                                      | Message                                                          | Fix? | Emitted from                                         |
| ----------------------------------------- | ---------------------------------------------------------------- | ---- | ---------------------------------------------------- |
| `gpuOcclusion.commandEncodingUnsupported` | GPU occlusion query resolve requires a command encoder resource. | —    | `packages/webgpu/src/render/frame/frame-boundary.ts` |

## gpuOcclusion.invalidQueryCount (1)

| Code                             | Message                                                   | Fix? | Emitted from                                 |
| -------------------------------- | --------------------------------------------------------- | ---- | -------------------------------------------- |
| `gpuOcclusion.invalidQueryCount` | GPU occlusion query resources require at least one query. | —    | `packages/webgpu/src/gpu/occlusion-query.ts` |

## gpuOcclusion.missingDeviceSupport (1)

| Code                                | Message                                                                        | Fix? | Emitted from                                 |
| ----------------------------------- | ------------------------------------------------------------------------------ | ---- | -------------------------------------------- |
| `gpuOcclusion.missingDeviceSupport` | GPU occlusion query resources require createQuerySet and createBuffer support. | —    | `packages/webgpu/src/gpu/occlusion-query.ts` |

## gpuOcclusion.resourceCreationFailed (1)

| Code                                  | Message                                         | Fix? | Emitted from                                 |
| ------------------------------------- | ----------------------------------------------- | ---- | -------------------------------------------- |
| `gpuOcclusion.resourceCreationFailed` | GPU occlusion query resource creation failed: … | —    | `packages/webgpu/src/gpu/occlusion-query.ts` |

## gpuTiming.invalidQueryCount (1)

| Code                          | Message                                                     | Fix? | Emitted from                            |
| ----------------------------- | ----------------------------------------------------------- | ---- | --------------------------------------- |
| `gpuTiming.invalidQueryCount` | GPU timestamp query resources require at least two queries. | —    | `packages/webgpu/src/gpu/gpu-timing.ts` |

## gpuTiming.missingDeviceSupport (1)

| Code                             | Message                                                                        | Fix? | Emitted from                            |
| -------------------------------- | ------------------------------------------------------------------------------ | ---- | --------------------------------------- |
| `gpuTiming.missingDeviceSupport` | GPU timestamp query resources require createQuerySet and createBuffer support. | —    | `packages/webgpu/src/gpu/gpu-timing.ts` |

## gpuTiming.resourceCreationFailed (1)

| Code                               | Message                                         | Fix? | Emitted from                            |
| ---------------------------------- | ----------------------------------------------- | ---- | --------------------------------------- |
| `gpuTiming.resourceCreationFailed` | GPU timestamp query resource creation failed: … | —    | `packages/webgpu/src/gpu/gpu-timing.ts` |

## gpuTiming.timestampQueryUnavailable (1)

| Code                                  | Message                                                                | Fix? | Emitted from                            |
| ------------------------------------- | ---------------------------------------------------------------------- | ---- | --------------------------------------- |
| `gpuTiming.timestampQueryUnavailable` | WebGPU timestamp queries require the 'timestamp-query' device feature. | —    | `packages/webgpu/src/gpu/gpu-timing.ts` |

## iblPreparationPass.missingTexturePreparation (1)

| Code                                           | Message                                                                           | Fix? | Emitted from                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `iblPreparationPass.missingTexturePreparation` | IBL preparation pass planning requires valid IBL texture preparation descriptors. | —    | `packages/webgpu/src/lighting/ibl-preparation-pass-plan.ts` |

## iblPreparationPass.submissionDeferred (1)

| Code                                    | Message                                                                                | Fix? | Emitted from                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `iblPreparationPass.submissionDeferred` | IBL texture preparation passes are planned, but GPU submission is not implemented yet. | —    | `packages/webgpu/src/lighting/ibl-preparation-pass-plan.ts` |

## iblPreparationPass.submissionUnsupported (1)

| Code                                       | Message                                                                           | Fix? | Emitted from                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `iblPreparationPass.submissionUnsupported` | IBL texture preparation pass submission is unsupported for the planned resources. | —    | `packages/webgpu/src/lighting/ibl-preparation-pass-plan.ts` |

## iblPreparationPass.unsupportedSlots (1)

| Code                                  | Message                                                                                               | Fix? | Emitted from                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `iblPreparationPass.unsupportedSlots` | IBL preparation pass planning cannot proceed while diffuse or specular texture slots are unsupported. | —    | `packages/webgpu/src/lighting/ibl-preparation-pass-plan.ts` |

## iblPreparationResourceSummary.missingDescriptors (1)

| Code                                               | Message                                                                   | Fix? | Emitted from                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `iblPreparationResourceSummary.missingDescriptors` | IBL preparation resource summary requires renderer-owned IBL descriptors. | —    | `packages/webgpu/src/lighting/ibl-preparation-resource-summary.ts` |

## iblPreparationResourceSummary.missingPassPlan (1)

| Code                                            | Message                                                                 | Fix? | Emitted from                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `iblPreparationResourceSummary.missingPassPlan` | IBL preparation resource summary requires valid preparation pass plans. | —    | `packages/webgpu/src/lighting/ibl-preparation-resource-summary.ts` |

## iblPreparationResourceSummary.missingTexturePreparation (1)

| Code                                                      | Message                                                                          | Fix? | Emitted from                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `iblPreparationResourceSummary.missingTexturePreparation` | IBL preparation resource summary requires valid texture preparation descriptors. | —    | `packages/webgpu/src/lighting/ibl-preparation-resource-summary.ts` |

## iblPreparationResourceSummary.passSubmissionDeferred (1)

| Code                                                   | Message                                                                  | Fix? | Emitted from                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------ |
| `iblPreparationResourceSummary.passSubmissionDeferred` | IBL preparation passes are planned, but GPU pass submission is deferred. | —    | `packages/webgpu/src/lighting/ibl-preparation-resource-summary.ts` |

## iblPreparationResourceSummary.shaderSamplingDeferred (1)

| Code                                                   | Message                                                                                          | Fix? | Emitted from                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------ |
| `iblPreparationResourceSummary.shaderSamplingDeferred` | IBL preparation resource status is data-only; StandardMaterial shader sampling remains deferred. | —    | `packages/webgpu/src/lighting/ibl-preparation-resource-summary.ts` |

## iblPreparationResourceSummary.textureUploadDeferred (1)

| Code                                                  | Message                                                                  | Fix? | Emitted from                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------ |
| `iblPreparationResourceSummary.textureUploadDeferred` | IBL texture descriptors are planned, but GPU texture upload is deferred. | —    | `packages/webgpu/src/lighting/ibl-preparation-resource-summary.ts` |

## iblPreparationResourceSummary.unsupportedPassPlan (1)

| Code                                                | Message                                                                         | Fix? | Emitted from                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `iblPreparationResourceSummary.unsupportedPassPlan` | IBL preparation pass planning is unsupported for the current texture resources. | —    | `packages/webgpu/src/lighting/ibl-preparation-resource-summary.ts` |

## iblPreparationResourceSummary.unsupportedTexturePreparation (1)

| Code                                                          | Message                                                                                    | Fix? | Emitted from                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------ |
| `iblPreparationResourceSummary.unsupportedTexturePreparation` | IBL texture preparation has unsupported slots and cannot be summarized as ready resources. | —    | `packages/webgpu/src/lighting/ibl-preparation-resource-summary.ts` |

## iblResourceDescriptor.missingDescriptor (1)

| Code                                      | Message                                                                                                                   | Fix? | Emitted from                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `iblResourceDescriptor.missingDescriptor` | IBL resource descriptor '…' is required by extracted environment packets but was not provided by renderer resource state. | —    | `packages/webgpu/src/lighting/ibl-resource-descriptor.ts` |

## iblSamplerDescriptor.allocationDeferred (1)

| Code                                      | Message                                                                      | Fix? | Emitted from                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `iblSamplerDescriptor.allocationDeferred` | IBL sampler descriptors are planned, but GPU sampler allocation is deferred. | —    | `packages/webgpu/src/lighting/ibl-sampler-descriptor-readiness.ts` |

## iblSamplerDescriptor.allocationUnsupported (1)

| Code                                         | Message                                                                    | Fix? | Emitted from                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `iblSamplerDescriptor.allocationUnsupported` | IBL sampler allocation is unsupported for the planned sampler descriptors. | —    | `packages/webgpu/src/lighting/ibl-sampler-descriptor-readiness.ts` |

## iblSamplerDescriptor.missingTexturePreparation (1)

| Code                                             | Message                                                                              | Fix? | Emitted from                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------ |
| `iblSamplerDescriptor.missingTexturePreparation` | IBL sampler descriptor readiness requires valid IBL texture preparation descriptors. | —    | `packages/webgpu/src/lighting/ibl-sampler-descriptor-readiness.ts` |

## iblSamplerDescriptor.unsupportedTextureSlots (1)

| Code                                           | Message                                                                              | Fix? | Emitted from                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------ |
| `iblSamplerDescriptor.unsupportedTextureSlots` | IBL sampler descriptor readiness cannot proceed while texture slots are unsupported. | —    | `packages/webgpu/src/lighting/ibl-sampler-descriptor-readiness.ts` |

## iblSamplerResource.missingSamplerDescriptors (1)

| Code                                           | Message                                                                 | Fix? | Emitted from                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------ |
| `iblSamplerResource.missingSamplerDescriptors` | IBL sampler resource allocation requires ready IBL sampler descriptors. | —    | `packages/webgpu/src/lighting/ibl-sampler-resource.ts` |

## iblSamplerResource.unsupportedSamplerDescriptors (1)

| Code                                               | Message                                                                                       | Fix? | Emitted from                                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------ |
| `iblSamplerResource.unsupportedSamplerDescriptors` | IBL sampler resource allocation cannot proceed while IBL sampler descriptors are unsupported. | —    | `packages/webgpu/src/lighting/ibl-sampler-resource.ts` |

## iblTexturePreparation.missingDescriptors (1)

| Code                                       | Message                                                                   | Fix? | Emitted from                                              |
| ------------------------------------------ | ------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `iblTexturePreparation.missingDescriptors` | IBL texture preparation requires renderer-owned IBL resource descriptors. | —    | `packages/webgpu/src/lighting/ibl-texture-preparation.ts` |

## iblTexturePreparation.preparationDeferred (1)

| Code                                        | Message                                                                                           | Fix? | Emitted from                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `iblTexturePreparation.preparationDeferred` | IBL texture descriptors are planned, but texture upload and prefiltering are not implemented yet. | —    | `packages/webgpu/src/lighting/ibl-texture-preparation.ts` |

## iblTexturePreparation.preparationUnsupported (1)

| Code                                           | Message                                                                                | Fix? | Emitted from                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `iblTexturePreparation.preparationUnsupported` | IBL texture upload and prefiltering are unsupported for the planned texture resources. | —    | `packages/webgpu/src/lighting/ibl-texture-preparation.ts` |

## iblTexturePreparation.unsupportedSlots (1)

| Code                                     | Message                                                                                                         | Fix? | Emitted from                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `iblTexturePreparation.unsupportedSlots` | IBL texture preparation cannot proceed while diffuse or specular descriptor slots are unsupported placeholders. | —    | `packages/webgpu/src/lighting/ibl-texture-preparation.ts` |

## iblTextureResource.diffuseIrradianceConvolutionDeferred (1)

| Code                                                      | Message                                                                                                              | Fix? | Emitted from                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `iblTextureResource.diffuseIrradianceConvolutionDeferred` | Diffuse IBL source texture requires compute irradiance convolution; no cube faces were provided for verbatim upload. | —    | `packages/webgpu/src/lighting/ibl-texture-resource-diffuse.ts` |

## iblTextureResource.diffuseIrradianceConvolutionDispatchFailed (1)

| Code                                                            | Message                       | Fix? | Emitted from                                                   |
| --------------------------------------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------- |
| `iblTextureResource.diffuseIrradianceConvolutionDispatchFailed` | (message composed at runtime) | —    | `packages/webgpu/src/lighting/ibl-texture-resource-diffuse.ts` |

## iblTextureResource.invalidDiffuseCubeSource (1)

| Code                                          | Message                       | Fix? | Emitted from                                                   |
| --------------------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------- |
| `iblTextureResource.invalidDiffuseCubeSource` | (message composed at runtime) | —    | `packages/webgpu/src/lighting/ibl-texture-resource-diffuse.ts` |

## iblTextureResource.invalidSpecularPmremSource (1)

| Code                                            | Message                       | Fix? | Emitted from                                                    |
| ----------------------------------------------- | ----------------------------- | ---- | --------------------------------------------------------------- |
| `iblTextureResource.invalidSpecularPmremSource` | (message composed at runtime) | —    | `packages/webgpu/src/lighting/ibl-texture-resource-specular.ts` |

## iblTextureResource.missingTexturePreparation (1)

| Code                                           | Message                                                                                     | Fix? | Emitted from                                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| `iblTextureResource.missingTexturePreparation` | Diffuse IBL texture resource allocation requires valid IBL texture preparation descriptors. | —    | `packages/webgpu/src/lighting/ibl-texture-resource-diffuse.ts`<br>`packages/webgpu/src/lighting/ibl-texture-resource-specular.ts` |

## iblTextureResource.specularPmremDeviceUnsupported (1)

| Code                                                | Message                                                                                                                                   | Fix? | Emitted from                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `iblTextureResource.specularPmremDeviceUnsupported` | Specular IBL PMREM execution requires texture, sampler, compute pipeline, bind group, command encoder, uniform buffer, and queue support. | —    | `packages/webgpu/src/lighting/ibl-texture-resource-specular.ts` |

## iblTextureResource.specularPmremDispatchFailed (1)

| Code                                             | Message                       | Fix? | Emitted from                                                    |
| ------------------------------------------------ | ----------------------------- | ---- | --------------------------------------------------------------- |
| `iblTextureResource.specularPmremDispatchFailed` | (message composed at runtime) | —    | `packages/webgpu/src/lighting/ibl-texture-resource-specular.ts` |

## iblTextureResource.specularSourceNotPrepared (1)

| Code                                           | Message                                                                                                                                                            | Fix? | Emitted from                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------- |
| `iblTextureResource.specularSourceNotPrepared` | Specular IBL slot '…' has no prepared source (cube faces, source texture, or equirect projection); a neutral placeholder cube is bound until a source is provided. | —    | `packages/webgpu/src/lighting/ibl-texture-resource-specular.ts` |

## iblTextureResource.unsupportedTextureSlots (1)

| Code                                         | Message                                                                                         | Fix? | Emitted from                                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| `iblTextureResource.unsupportedTextureSlots` | Diffuse IBL texture resource allocation cannot proceed while IBL texture slots are unsupported. | —    | `packages/webgpu/src/lighting/ibl-texture-resource-diffuse.ts`<br>`packages/webgpu/src/lighting/ibl-texture-resource-specular.ts` |

## idBufferPick.createBindGroupFailed (1)

| Code                                 | Message                                          | Fix? | Emitted from                                    |
| ------------------------------------ | ------------------------------------------------ | ---- | ----------------------------------------------- |
| `idBufferPick.createBindGroupFailed` | WebGPU ID-buffer picking requires createTexture. | —    | `packages/webgpu/src/picking/id-buffer-pick.ts` |

## idBufferPick.createBindGroupUnavailable (1)

| Code                                      | Message                                            | Fix? | Emitted from                                    |
| ----------------------------------------- | -------------------------------------------------- | ---- | ----------------------------------------------- |
| `idBufferPick.createBindGroupUnavailable` | WebGPU ID-buffer picking requires createBindGroup. | —    | `packages/webgpu/src/picking/id-buffer-pick.ts` |

## idBufferPick.createBufferFailed (1)

| Code                              | Message                                            | Fix? | Emitted from                                    |
| --------------------------------- | -------------------------------------------------- | ---- | ----------------------------------------------- |
| `idBufferPick.createBufferFailed` | WebGPU ID-buffer picking requires createBindGroup. | —    | `packages/webgpu/src/picking/id-buffer-pick.ts` |

## idBufferPick.createRenderPipelineUnavailable (1)

| Code                                           | Message                                                 | Fix? | Emitted from                                    |
| ---------------------------------------------- | ------------------------------------------------------- | ---- | ----------------------------------------------- |
| `idBufferPick.createRenderPipelineUnavailable` | WebGPU ID-buffer picking requires createRenderPipeline. | —    | `packages/webgpu/src/picking/id-buffer-pick.ts` |

## idBufferPick.createTextureUnavailable (1)

| Code                                    | Message                                          | Fix? | Emitted from                                    |
| --------------------------------------- | ------------------------------------------------ | ---- | ----------------------------------------------- |
| `idBufferPick.createTextureUnavailable` | WebGPU ID-buffer picking requires createTexture. | —    | `packages/webgpu/src/picking/id-buffer-pick.ts` |

## idBufferPick.missingPickPipeline (1)

| Code                               | Message                                     | Fix? | Emitted from                                    |
| ---------------------------------- | ------------------------------------------- | ---- | ----------------------------------------------- |
| `idBufferPick.missingPickPipeline` | Missing ID-buffer picking pipeline for '…'. | —    | `packages/webgpu/src/picking/id-buffer-pick.ts` |

## idBufferPick.pipelineCreationFailed (1)

| Code                                  | Message                       | Fix? | Emitted from                                    |
| ------------------------------------- | ----------------------------- | ---- | ----------------------------------------------- |
| `idBufferPick.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/picking/id-buffer-pick.ts` |

## idBufferPick.pipelineLayoutUnavailable (1)

| Code                                     | Message                                                                                               | Fix? | Emitted from                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------- |
| `idBufferPick.pipelineLayoutUnavailable` | ID-buffer picking requires createBindGroupLayout and createPipelineLayout to share frame bind groups. | —    | `packages/webgpu/src/picking/id-buffer-pick.ts` |

## idBufferPick.shaderCreationFailed (1)

| Code                                | Message                                                 | Fix? | Emitted from                                    |
| ----------------------------------- | ------------------------------------------------------- | ---- | ----------------------------------------------- |
| `idBufferPick.shaderCreationFailed` | WebGPU ID-buffer picking requires createRenderPipeline. | —    | `packages/webgpu/src/picking/id-buffer-pick.ts` |

## idBufferPick.unsupportedBatchKey (1)

| Code                               | Message                                                           | Fix? | Emitted from                                    |
| ---------------------------------- | ----------------------------------------------------------------- | ---- | ----------------------------------------------- |
| `idBufferPick.unsupportedBatchKey` | ID-buffer picking currently supports rigid, unmorphed mesh draws. | —    | `packages/webgpu/src/picking/id-buffer-pick.ts` |

## indirectDraw.bufferCreationFailed (1)

| Code                                | Message                       | Fix? | Emitted from                                                |
| ----------------------------------- | ----------------------------- | ---- | ----------------------------------------------------------- |
| `indirectDraw.bufferCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/render/draw/indirect-draw-commands.ts` |

## indirectDraw.createBufferUnavailable (1)

| Code                                   | Message                                                       | Fix? | Emitted from                                                |
| -------------------------------------- | ------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `indirectDraw.createBufferUnavailable` | WebGPU device cannot create an indirect draw argument buffer. | —    | `packages/webgpu/src/render/draw/indirect-draw-commands.ts` |

## indirectDraw.firstInstanceUnsupported (1)

| Code                                    | Message                                                                                          | Fix? | Emitted from                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `indirectDraw.firstInstanceUnsupported` | Indirect draws with non-zero firstInstance require the 'indirect-first-instance' WebGPU feature. | —    | `packages/webgpu/src/render/draw/indirect-draw-commands.ts` |

## indirectDraw.queueWriteBufferUnavailable (1)

| Code                                       | Message                                                            | Fix? | Emitted from                                                |
| ------------------------------------------ | ------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `indirectDraw.queueWriteBufferUnavailable` | WebGPU queue cannot upload indirect draw argument buffer contents. | —    | `packages/webgpu/src/render/draw/indirect-draw-commands.ts` |

## instanceAttributeBuffer.emptyData (1)

| Code                                | Message                                                                | Fix? | Emitted from                                                            |
| ----------------------------------- | ---------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `instanceAttributeBuffer.emptyData` | Packed instance attribute data must contain at least one instance row. | —    | `packages/webgpu/src/resources/attributes/instance-attribute-buffer.ts` |

## instanceAttributeBuffer.invalidUsageFlags (1)

| Code                                        | Message                                                                  | Fix? | Emitted from                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------- |
| `instanceAttributeBuffer.invalidUsageFlags` | Instance attribute vertex buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/attributes/instance-attribute-buffer.ts` |

## instanceAttributeBuffer.layoutMismatch (1)

| Code                                     | Message                                                                       | Fix? | Emitted from                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `instanceAttributeBuffer.layoutMismatch` | Packed instance attribute data length must be divisible by the layout stride. | —    | `packages/webgpu/src/resources/attributes/instance-attribute-buffer.ts` |

## instanceAttributeBuffer.packDiagnostic (1)

| Code                                     | Message                                                                  | Fix? | Emitted from                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------- |
| `instanceAttributeBuffer.packDiagnostic` | Instance attribute vertex buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/attributes/instance-attribute-buffer.ts` |

## instanceAttributeGpuBuffer.creationFailed (1)

| Code                                        | Message                                           | Fix? | Emitted from                                                            |
| ------------------------------------------- | ------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `instanceAttributeGpuBuffer.creationFailed` | Failed to create instance attribute buffer '…': … | —    | `packages/webgpu/src/resources/attributes/instance-attribute-buffer.ts` |

## instanceAttributeGpuBuffer.nullDescriptorPlan (1)

| Code                                            | Message                                                                     | Fix? | Emitted from                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `instanceAttributeGpuBuffer.nullDescriptorPlan` | Cannot create an instance attribute GPU buffer from a null descriptor plan. | —    | `packages/webgpu/src/resources/attributes/instance-attribute-buffer.ts` |

## instanceTintBuffer.emptyData (1)

| Code                           | Message                                                        | Fix? | Emitted from                                                       |
| ------------------------------ | -------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `instanceTintBuffer.emptyData` | Packed instance tint data must contain at least one vec4 tint. | —    | `packages/webgpu/src/resources/attributes/instance-tint-buffer.ts` |

## instanceTintBuffer.invalidUsageFlags (1)

| Code                                   | Message                                                             | Fix? | Emitted from                                                       |
| -------------------------------------- | ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `instanceTintBuffer.invalidUsageFlags` | Instance tint vertex buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/attributes/instance-tint-buffer.ts` |

## instanceTintBuffer.packDiagnostic (1)

| Code                                | Message                                                             | Fix? | Emitted from                                                       |
| ----------------------------------- | ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `instanceTintBuffer.packDiagnostic` | Instance tint vertex buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/attributes/instance-tint-buffer.ts` |

## instanceTintGpuBuffer.creationFailed (1)

| Code                                   | Message                                      | Fix? | Emitted from                                                       |
| -------------------------------------- | -------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `instanceTintGpuBuffer.creationFailed` | Failed to create instance tint buffer '…': … | —    | `packages/webgpu/src/resources/attributes/instance-tint-buffer.ts` |

## instanceTintGpuBuffer.nullDescriptorPlan (1)

| Code                                       | Message                                                                | Fix? | Emitted from                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `instanceTintGpuBuffer.nullDescriptorPlan` | Cannot create an instance tint GPU buffer from a null descriptor plan. | —    | `packages/webgpu/src/resources/attributes/instance-tint-buffer.ts` |

## light.invalidAreaSize (1)

| Code                    | Message                                              | Fix? | Emitted from                                                   |
| ----------------------- | ---------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `light.invalidAreaSize` | Area lights require finite width > 0 and height > 0. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## light.invalidIntensity (1)

| Code                     | Message                               | Fix? | Emitted from                                                   |
| ------------------------ | ------------------------------------- | ---- | -------------------------------------------------------------- |
| `light.invalidIntensity` | Light intensity must be non-negative. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## light.invalidRange (1)

| Code                 | Message                                  | Fix? | Emitted from                                                   |
| -------------------- | ---------------------------------------- | ---- | -------------------------------------------------------------- |
| `light.invalidRange` | Point and spot lights require range > 0. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## light.invalidSpotCone (1)

| Code                    | Message                                                    | Fix? | Emitted from                                                   |
| ----------------------- | ---------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `light.invalidSpotCone` | Spot lights require 0 <= innerConeAngle <= outerConeAngle. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## light.zeroLayerMask (1)

| Code                  | Message                           | Fix? | Emitted from                                                   |
| --------------------- | --------------------------------- | ---- | -------------------------------------------------------------- |
| `light.zeroLayerMask` | Light layerMask must not be zero. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## lightBindGroup.missingLayoutKey (1)

| Code                              | Message                                                   | Fix? | Emitted from                                       |
| --------------------------------- | --------------------------------------------------------- | ---- | -------------------------------------------------- |
| `lightBindGroup.missingLayoutKey` | Light bind group planning requires a layout resource key. | —    | `packages/webgpu/src/lighting/light-bind-group.ts` |

## lightBindGroup.missingLightGpuBufferResource (1)

| Code                                           | Message                                                         | Fix? | Emitted from                                       |
| ---------------------------------------------- | --------------------------------------------------------------- | ---- | -------------------------------------------------- |
| `lightBindGroup.missingLightGpuBufferResource` | Light bind group planning requires a light GPU buffer resource. | —    | `packages/webgpu/src/lighting/light-bind-group.ts` |

## lightBindGroupLayout.creationFailed (1)

| Code                                  | Message                                         | Fix? | Emitted from                                              |
| ------------------------------------- | ----------------------------------------------- | ---- | --------------------------------------------------------- |
| `lightBindGroupLayout.creationFailed` | Failed to create light bind group layout '…': … | —    | `packages/webgpu/src/lighting/light-bind-group-layout.ts` |

## lightBindGroupLayout.missingDeviceSupport (1)

| Code                                        | Message                                               | Fix? | Emitted from                                              |
| ------------------------------------------- | ----------------------------------------------------- | ---- | --------------------------------------------------------- |
| `lightBindGroupLayout.missingDeviceSupport` | WebGPU device cannot create light bind group layouts. | —    | `packages/webgpu/src/lighting/light-bind-group-layout.ts` |

## lightBindGroupResource.creationFailed (1)

| Code                                    | Message                                  | Fix? | Emitted from                                       |
| --------------------------------------- | ---------------------------------------- | ---- | -------------------------------------------------- |
| `lightBindGroupResource.creationFailed` | Failed to create light bind group '…': … | —    | `packages/webgpu/src/lighting/light-bind-group.ts` |

## lightBindGroupResource.invalidDescriptorPlan (1)

| Code                                           | Message                                                           | Fix? | Emitted from                                       |
| ---------------------------------------------- | ----------------------------------------------------------------- | ---- | -------------------------------------------------- |
| `lightBindGroupResource.invalidDescriptorPlan` | Cannot create a light bind group from an invalid descriptor plan. | —    | `packages/webgpu/src/lighting/light-bind-group.ts` |

## lightBindGroupResource.missingDeviceSupport (1)

| Code                                          | Message                                        | Fix? | Emitted from                                       |
| --------------------------------------------- | ---------------------------------------------- | ---- | -------------------------------------------------- |
| `lightBindGroupResource.missingDeviceSupport` | WebGPU device cannot create light bind groups. | —    | `packages/webgpu/src/lighting/light-bind-group.ts` |

## lightBindGroupResource.missingLayout (1)

| Code                                   | Message                                        | Fix? | Emitted from                                       |
| -------------------------------------- | ---------------------------------------------- | ---- | -------------------------------------------------- |
| `lightBindGroupResource.missingLayout` | WebGPU device cannot create light bind groups. | —    | `packages/webgpu/src/lighting/light-bind-group.ts` |

## lightBindGroupResource.nullDescriptorPlan (1)

| Code                                        | Message                                            | Fix? | Emitted from                                       |
| ------------------------------------------- | -------------------------------------------------- | ---- | -------------------------------------------------- |
| `lightBindGroupResource.nullDescriptorPlan` | Cannot create a light bind group from a null plan. | —    | `packages/webgpu/src/lighting/light-bind-group.ts` |

## lightBufferDescriptor.invalidUsageFlags (1)

| Code                                      | Message                                              | Fix? | Emitted from                                    |
| ----------------------------------------- | ---------------------------------------------------- | ---- | ----------------------------------------------- |
| `lightBufferDescriptor.invalidUsageFlags` | Light buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/lighting/light-packing.ts` |

## lightCookie.invalidIntensity (1)

| Code                           | Message                                                      | Fix? | Emitted from                                                   |
| ------------------------------ | ------------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `lightCookie.invalidIntensity` | Light cookie intensity must be a finite non-negative number. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## lightCookie.invalidTexture (1)

| Code                         | Message                                              | Fix? | Emitted from                                                   |
| ---------------------------- | ---------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `lightCookie.invalidTexture` | Light cookie texture must be a texture asset handle. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## lightGpuBuffer.creationFailed (1)

| Code                            | Message                                    | Fix? | Emitted from                                    |
| ------------------------------- | ------------------------------------------ | ---- | ----------------------------------------------- |
| `lightGpuBuffer.creationFailed` | Failed to create light float buffer '…': … | —    | `packages/webgpu/src/lighting/light-packing.ts` |

## lightGpuBuffer.nullDescriptorPlan (1)

| Code                                | Message                                                      | Fix? | Emitted from                                    |
| ----------------------------------- | ------------------------------------------------------------ | ---- | ----------------------------------------------- |
| `lightGpuBuffer.nullDescriptorPlan` | Cannot create light GPU buffers from a null descriptor plan. | —    | `packages/webgpu/src/lighting/light-packing.ts` |

## lightShaderBinding.missingBinding (1)

| Code                                | Message                                            | Fix? | Emitted from                                            |
| ----------------------------------- | -------------------------------------------------- | ---- | ------------------------------------------------------- |
| `lightShaderBinding.missingBinding` | Light shader readiness requires light GPU buffers. | —    | `packages/webgpu/src/lighting/light-shader-metadata.ts` |

## lightShaderBinding.resourceMismatch (1)

| Code                                  | Message                                            | Fix? | Emitted from                                            |
| ------------------------------------- | -------------------------------------------------- | ---- | ------------------------------------------------------- |
| `lightShaderBinding.resourceMismatch` | Light shader readiness requires light GPU buffers. | —    | `packages/webgpu/src/lighting/light-shader-metadata.ts` |

## lightShaderReadiness.metadataInvalid (1)

| Code                                   | Message                                          | Fix? | Emitted from                                            |
| -------------------------------------- | ------------------------------------------------ | ---- | ------------------------------------------------------- |
| `lightShaderReadiness.metadataInvalid` | Light shader binding metadata validation failed. | —    | `packages/webgpu/src/lighting/light-shader-metadata.ts` |

## lightShaderReadiness.missingBindGroup (1)

| Code                                    | Message                                                      | Fix? | Emitted from                                            |
| --------------------------------------- | ------------------------------------------------------------ | ---- | ------------------------------------------------------- |
| `lightShaderReadiness.missingBindGroup` | Light shader readiness requires a light bind group resource. | —    | `packages/webgpu/src/lighting/light-shader-metadata.ts` |

## lightShaderReadiness.missingLayout (1)

| Code                                 | Message                                                    | Fix? | Emitted from                                            |
| ------------------------------------ | ---------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `lightShaderReadiness.missingLayout` | Light shader readiness requires a light bind group layout. | —    | `packages/webgpu/src/lighting/light-shader-metadata.ts` |

## lightShaderReadiness.missingLightGpuBuffers (1)

| Code                                          | Message                                            | Fix? | Emitted from                                            |
| --------------------------------------------- | -------------------------------------------------- | ---- | ------------------------------------------------------- |
| `lightShaderReadiness.missingLightGpuBuffers` | Light shader readiness requires light GPU buffers. | —    | `packages/webgpu/src/lighting/light-shader-metadata.ts` |

## loadGlbFromUri.fetchUnavailable (1)

| Code                              | Message                                                                | Fix? | Emitted from                                   |
| --------------------------------- | ---------------------------------------------------------------------- | ---- | ---------------------------------------------- |
| `loadGlbFromUri.fetchUnavailable` | GLB URI loading requires globalThis.fetch or an explicit fetch option. | —    | `packages/render/src/assets/glb-uri-loader.ts` |

## loadGlbFromUri.imageReadFailed (1)

| Code                             | Message                                       | Fix? | Emitted from                                                                                                     |
| -------------------------------- | --------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| `loadGlbFromUri.imageReadFailed` | GLB image … URI '…' bytes were not available. | —    | `packages/render/src/assets/glb-uri-image-bytes.ts`<br>`packages/render/src/assets/glb-uri-image-decode-task.ts` |

## loadGlbFromUri.invalidUrl (1)

| Code                        | Message                                                                | Fix? | Emitted from                                   |
| --------------------------- | ---------------------------------------------------------------------- | ---- | ---------------------------------------------- |
| `loadGlbFromUri.invalidUrl` | GLB URI loading requires globalThis.fetch or an explicit fetch option. | —    | `packages/render/src/assets/glb-uri-loader.ts` |

## loadGlbFromUri.loaderDiagnostic (1)

| Code                              | Message                       | Fix? | Emitted from                                   |
| --------------------------------- | ----------------------------- | ---- | ---------------------------------------------- |
| `loadGlbFromUri.loaderDiagnostic` | (message composed at runtime) | —    | `packages/render/src/assets/glb-uri-loader.ts` |

## loadGlbFromUri.unsupportedBufferUri (1)

| Code                                  | Message                                                                                          | Fix? | Emitted from                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `loadGlbFromUri.unsupportedBufferUri` | GLB external buffer … uses an embedded data URI, which must be provided via externalBufferBytes. | —    | `packages/render/src/assets/glb-uri-external-fetch-resolve.ts` |

## loadGlbFromUri.unsupportedImageUri (1)

| Code                                 | Message                             | Fix? | Emitted from                                                                                                                |
| ------------------------------------ | ----------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------- |
| `loadGlbFromUri.unsupportedImageUri` | GLB image … does not provide a URI. | —    | `packages/render/src/assets/glb-uri-external-fetch-resolve.ts`<br>`packages/render/src/assets/glb-uri-image-decode-task.ts` |

## loadGltfFromUri.fetchUnavailable (1)

| Code                               | Message                                                                 | Fix? | Emitted from                                    |
| ---------------------------------- | ----------------------------------------------------------------------- | ---- | ----------------------------------------------- |
| `loadGltfFromUri.fetchUnavailable` | glTF URI loading requires globalThis.fetch or an explicit fetch option. | —    | `packages/render/src/assets/gltf-uri-loader.ts` |

## loadGltfFromUri.imageReadFailed (1)

| Code                              | Message                       | Fix? | Emitted from                                                                                                         |
| --------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------- |
| `loadGltfFromUri.imageReadFailed` | (message composed at runtime) | —    | `packages/render/src/assets/gltf-uri-image-decode-task.ts`<br>`packages/render/src/assets/gltf-uri-image-sources.ts` |

## loadGltfFromUri.invalidJson (1)

| Code                          | Message                       | Fix? | Emitted from                                  |
| ----------------------------- | ----------------------------- | ---- | --------------------------------------------- |
| `loadGltfFromUri.invalidJson` | (message composed at runtime) | —    | `packages/render/src/assets/gltf-uri-json.ts` |

## loadGltfFromUri.invalidUrl (1)

| Code                         | Message                                                                 | Fix? | Emitted from                                    |
| ---------------------------- | ----------------------------------------------------------------------- | ---- | ----------------------------------------------- |
| `loadGltfFromUri.invalidUrl` | glTF URI loading requires globalThis.fetch or an explicit fetch option. | —    | `packages/render/src/assets/gltf-uri-loader.ts` |

## loadGltfFromUri.loaderDiagnostic (1)

| Code                               | Message                       | Fix? | Emitted from                                    |
| ---------------------------------- | ----------------------------- | ---- | ----------------------------------------------- |
| `loadGltfFromUri.loaderDiagnostic` | (message composed at runtime) | —    | `packages/render/src/assets/gltf-uri-loader.ts` |

## loadGltfFromUri.unsupportedBufferUri (1)

| Code                                   | Message                                                                                         | Fix? | Emitted from                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `loadGltfFromUri.unsupportedBufferUri` | glTF buffer … uses a data URI; this loader currently expects same-origin external buffer files. | —    | `packages/render/src/assets/gltf-uri-external-fetch-resolve.ts` |

## loadGltfFromUri.unsupportedImageUri (1)

| Code                                  | Message                              | Fix? | Emitted from                                                                                                                  |
| ------------------------------------- | ------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------- |
| `loadGltfFromUri.unsupportedImageUri` | glTF image … does not provide a URI. | —    | `packages/render/src/assets/gltf-uri-external-fetch-resolve.ts`<br>`packages/render/src/assets/gltf-uri-image-decode-task.ts` |

## loadHdrFromUri.fetchFailed (1)

| Code                         | Message                                  | Fix? | Emitted from                                        |
| ---------------------------- | ---------------------------------------- | ---- | --------------------------------------------------- |
| `loadHdrFromUri.fetchFailed` | Fetching HDR URI '…' failed with HTTP …. | —    | `packages/render/src/assets/hdr-rgbe-uri-loader.ts` |

## loadHdrFromUri.fetchUnavailable (1)

| Code                              | Message                                                                | Fix? | Emitted from                                        |
| --------------------------------- | ---------------------------------------------------------------------- | ---- | --------------------------------------------------- |
| `loadHdrFromUri.fetchUnavailable` | HDR URI loading requires globalThis.fetch or an explicit fetch option. | —    | `packages/render/src/assets/hdr-rgbe-uri-loader.ts` |

## loadHdrFromUri.httpError (1)

| Code                       | Message                                  | Fix? | Emitted from                                        |
| -------------------------- | ---------------------------------------- | ---- | --------------------------------------------------- |
| `loadHdrFromUri.httpError` | Fetching HDR URI '…' failed with HTTP …. | —    | `packages/render/src/assets/hdr-rgbe-uri-loader.ts` |

## loadHdrFromUri.invalidUrl (1)

| Code                        | Message                                                                | Fix? | Emitted from                                        |
| --------------------------- | ---------------------------------------------------------------------- | ---- | --------------------------------------------------- |
| `loadHdrFromUri.invalidUrl` | HDR URI loading requires globalThis.fetch or an explicit fetch option. | —    | `packages/render/src/assets/hdr-rgbe-uri-loader.ts` |

## loadHdrFromUri.parseDiagnostic (1)

| Code                             | Message                       | Fix? | Emitted from                                        |
| -------------------------------- | ----------------------------- | ---- | --------------------------------------------------- |
| `loadHdrFromUri.parseDiagnostic` | (message composed at runtime) | —    | `packages/render/src/assets/hdr-rgbe-uri-loader.ts` |

## loadHdrFromUri.readFailed (1)

| Code                        | Message                       | Fix? | Emitted from                                        |
| --------------------------- | ----------------------------- | ---- | --------------------------------------------------- |
| `loadHdrFromUri.readFailed` | (message composed at runtime) | —    | `packages/render/src/assets/hdr-rgbe-uri-loader.ts` |

## localLightAtlasSlot.invalidRequest (1)

| Code                                 | Message                                                     | Fix? | Emitted from                                                       |
| ------------------------------------ | ----------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `localLightAtlasSlot.invalidRequest` | Local light atlas slot '…' has invalid …x… request for …x…. | —    | `packages/webgpu/src/lighting/local-light-atlas-slot-allocator.ts` |

## localLightAtlasSlot.slotUnavailable (1)

| Code                                  | Message                                              | Fix? | Emitted from                                                       |
| ------------------------------------- | ---------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `localLightAtlasSlot.slotUnavailable` | Local light atlas slot '…' could not fit …x… in …x…. | —    | `packages/webgpu/src/lighting/local-light-atlas-slot-allocator.ts` |

## localLightClusterCookie.bufferCreationFailed (1)

| Code                                           | Message                                                                | Fix? | Emitted from                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `localLightClusterCookie.bufferCreationFailed` | Clustered local-light cookie matrix buffer '…' could not be created: … | —    | `packages/webgpu/src/lighting/local-light-cookie-matrices.ts` |

## localLightClusterCookie.invalidLightDirection (1)

| Code                                            | Message                                                            | Fix? | Emitted from                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------ | ---- | ------------------------------------------------------------- |
| `localLightClusterCookie.invalidLightDirection` | Clustered spot cookie light '…' has a zero-length light direction. | —    | `packages/webgpu/src/lighting/local-light-cookie-matrices.ts` |

## localLightClusterCookie.missingLightTransform (1)

| Code                                            | Message                                                                | Fix? | Emitted from                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `localLightClusterCookie.missingLightTransform` | Clustered spot cookie light '…' references missing transform offset …. | —    | `packages/webgpu/src/lighting/local-light-cookie-matrices.ts` |

## localLightClusterCookie.textureArrayIncompatible (1)

| Code                                               | Message                                                                               | Fix? | Emitted from                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `localLightClusterCookie.textureArrayIncompatible` | Clustered local-light cookie array '…' has incompatible layer layout for texture '…'. | —    | `packages/webgpu/src/lighting/local-light-cookie-textures.ts` |

## localLightClusterCookie.textureArrayMissingSourceData (1)

| Code                                                    | Message                                                                               | Fix? | Emitted from                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `localLightClusterCookie.textureArrayMissingSourceData` | Clustered local-light cookie array '…' requires source texture bytes for every layer. | —    | `packages/webgpu/src/lighting/local-light-cookie-textures.ts` |

## localLightClusterCookie.textureAtlasIncompatible (1)

| Code                                               | Message                                                                              | Fix? | Emitted from                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------- |
| `localLightClusterCookie.textureAtlasIncompatible` | Clustered local-light cookie atlas '…' has incompatible source data for texture '…'. | —    | `packages/webgpu/src/lighting/local-light-cookie-textures.ts` |

## localLightClusterCookie.textureAtlasMissingSourceData (1)

| Code                                                    | Message                                                                       | Fix? | Emitted from                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `localLightClusterCookie.textureAtlasMissingSourceData` | Clustered local-light cookie atlas '…' requires source texture bytes for '…'. | —    | `packages/webgpu/src/lighting/local-light-cookie-textures.ts` |

## localLightClusterCookie.textureAtlasUploadFailed (1)

| Code                                               | Message                                                                 | Fix? | Emitted from                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `localLightClusterCookie.textureAtlasUploadFailed` | Clustered local-light cookie atlas '…' upload failed for texture '…': … | —    | `packages/webgpu/src/lighting/local-light-cookie-textures.ts` |

## localLightClusterCookie.textureAtlasUploadUnavailable (1)

| Code                                                    | Message                                                                                                                     | Fix? | Emitted from                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `localLightClusterCookie.textureAtlasUploadUnavailable` | Clustered local-light cookie atlas '…' cannot upload source texture tiles because WebGPU queue.writeTexture is unavailable. | —    | `packages/webgpu/src/lighting/local-light-cookie-textures.ts` |

## localLightClusterCookie.textureNot2d (1)

| Code                                   | Message                                               | Fix? | Emitted from                                                   |
| -------------------------------------- | ----------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `localLightClusterCookie.textureNot2d` | Clustered spot-light cookie '…' must be a 2D texture. | —    | `packages/webgpu/src/lighting/local-light-cookie-resources.ts` |

## localLightClusterCookie.textureNotCube (1)

| Code                                     | Message                                                                  | Fix? | Emitted from                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `localLightClusterCookie.textureNotCube` | Clustered point-light cookie '…' must be a cube texture with six layers. | —    | `packages/webgpu/src/lighting/local-light-cookie-resources.ts` |

## localLightClusterGpuBuffer.creationFailed (1)

| Code                                        | Message                                            | Fix? | Emitted from                                                       |
| ------------------------------------------- | -------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `localLightClusterGpuBuffer.creationFailed` | Failed to create local-light cluster buffer '…': … | —    | `packages/webgpu/src/lighting/local-light-cluster-gpu-resource.ts` |

## matcapFrameResources.missingMaterial (1)

| Code                                   | Message                                                              | Fix? | Emitted from                                                     |
| -------------------------------------- | -------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `matcapFrameResources.missingMaterial` | Matcap frame GPU resource creation requires a matcap material asset. | —    | `packages/webgpu/src/materials/matcap/matcap-frame-resources.ts` |

## matcapFrameResources.missingMesh (1)

| Code                               | Message                                                   | Fix? | Emitted from                                                     |
| ---------------------------------- | --------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `matcapFrameResources.missingMesh` | Matcap frame GPU resource creation requires a mesh asset. | —    | `packages/webgpu/src/materials/matcap/matcap-frame-resources.ts` |

## matcapFrameResources.missingViewUniforms (1)

| Code                                       | Message                                                           | Fix? | Emitted from                                                     |
| ------------------------------------------ | ----------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `matcapFrameResources.missingViewUniforms` | Matcap frame GPU resource creation requires packed view uniforms. | —    | `packages/webgpu/src/materials/matcap/matcap-frame-resources.ts` |

## matcapFrameResources.missingWorldTransforms (1)

| Code                                          | Message                                                              | Fix? | Emitted from                                                     |
| --------------------------------------------- | -------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `matcapFrameResources.missingWorldTransforms` | Matcap frame GPU resource creation requires packed world transforms. | —    | `packages/webgpu/src/materials/matcap/matcap-frame-resources.ts` |

## matcapMaterialBindGroup.missingMaterialResource (1)

| Code                                              | Message                                                                          | Fix? | Emitted from                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `matcapMaterialBindGroup.missingMaterialResource` | Matcap material bind group planning requires a material uniform buffer resource. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group.ts` |

## matcapMaterialBindGroup.missingSamplerResource (1)

| Code                                             | Message                                                     | Fix? | Emitted from                                                |
| ------------------------------------------------ | ----------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `matcapMaterialBindGroup.missingSamplerResource` | Matcap material bind group planning requires a sampler key. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group.ts` |

## matcapMaterialBindGroup.missingTextureResource (1)

| Code                                             | Message                                                     | Fix? | Emitted from                                                |
| ------------------------------------------------ | ----------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `matcapMaterialBindGroup.missingTextureResource` | Matcap material bind group planning requires a texture key. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group.ts` |

## matcapMaterialBindGroupLayout.invalidGroup (1)

| Code                                         | Message                                                            | Fix? | Emitted from                                                       |
| -------------------------------------------- | ------------------------------------------------------------------ | ---- | ------------------------------------------------------------------ |
| `matcapMaterialBindGroupLayout.invalidGroup` | Matcap material resources must use bind group 2; received group …. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group-layout.ts` |

## matcapMaterialBindGroupLayout.missingBinding (1)

| Code                                           | Message                                                          | Fix? | Emitted from                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `matcapMaterialBindGroupLayout.missingBinding` | Matcap material bind group layout is missing required binding …. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group-layout.ts` |

## matcapMaterialBindGroupLayout.resourceKindMismatch (1)

| Code                                                 | Message                                         | Fix? | Emitted from                                                       |
| ---------------------------------------------------- | ----------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `matcapMaterialBindGroupLayout.resourceKindMismatch` | Matcap material binding … must be '…', not '…'. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group-layout.ts` |

## matcapMaterialBindGroupResource.creationFailed (1)

| Code                                             | Message                                            | Fix? | Emitted from                                                |
| ------------------------------------------------ | -------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `matcapMaterialBindGroupResource.creationFailed` | Failed to create matcap material bind group '…': … | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group.ts` |

## matcapMaterialBindGroupResource.invalidDescriptorPlan (1)

| Code                                                    | Message                                                                     | Fix? | Emitted from                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `matcapMaterialBindGroupResource.invalidDescriptorPlan` | Cannot create a matcap material bind group from an invalid descriptor plan. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group.ts` |

## matcapMaterialBindGroupResource.invalidLayout (1)

| Code                                            | Message                                                            | Fix? | Emitted from                                                |
| ----------------------------------------------- | ------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `matcapMaterialBindGroupResource.invalidLayout` | Matcap material bind group layout resource must be group 2, not …. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group.ts` |

## matcapMaterialBindGroupResource.missingBufferResource (1)

| Code                                                    | Message                                                      | Fix? | Emitted from                                                |
| ------------------------------------------------------- | ------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `matcapMaterialBindGroupResource.missingBufferResource` | Missing GPU buffer resource '…' for matcap material group 2. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group.ts` |

## matcapMaterialBindGroupResource.missingDeviceSupport (1)

| Code                                                   | Message                                                  | Fix? | Emitted from                                                |
| ------------------------------------------------------ | -------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `matcapMaterialBindGroupResource.missingDeviceSupport` | WebGPU device cannot create matcap material bind groups. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group.ts` |

## matcapMaterialBindGroupResource.missingLayout (1)

| Code                                            | Message                                                                 | Fix? | Emitted from                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `matcapMaterialBindGroupResource.missingLayout` | Matcap material bind group creation requires a group-2 layout resource. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group.ts` |

## matcapMaterialBindGroupResource.missingSamplerResource (1)

| Code                                                     | Message                                                       | Fix? | Emitted from                                                |
| -------------------------------------------------------- | ------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `matcapMaterialBindGroupResource.missingSamplerResource` | Missing GPU sampler resource '…' for matcap material group 2. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group.ts` |

## matcapMaterialBindGroupResource.missingTextureResource (1)

| Code                                                     | Message                                                            | Fix? | Emitted from                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `matcapMaterialBindGroupResource.missingTextureResource` | Missing GPU texture view resource '…' for matcap material group 2. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group.ts` |

## matcapMaterialBindGroupResource.nullDescriptorPlan (1)

| Code                                                 | Message                                                                 | Fix? | Emitted from                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `matcapMaterialBindGroupResource.nullDescriptorPlan` | Cannot create a matcap material bind group from a null descriptor plan. | —    | `packages/webgpu/src/materials/matcap/matcap-bind-group.ts` |

## matcapMaterialBuffer.invalidUniformData (1)

| Code                                      | Message                                                                       | Fix? | Emitted from                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `matcapMaterialBuffer.invalidUniformData` | Packed matcap material uniform data must match the documented 16-byte layout. | —    | `packages/webgpu/src/materials/matcap/matcap-material-buffer.ts` |

## matcapMaterialBuffer.invalidUsageFlags (1)

| Code                                     | Message                                                                | Fix? | Emitted from                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `matcapMaterialBuffer.invalidUsageFlags` | Matcap material uniform buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/materials/matcap/matcap-material-buffer.ts` |

## matcapMaterialBuffer.nullPackedMaterial (1)

| Code                                      | Message                                                                           | Fix? | Emitted from                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `matcapMaterialBuffer.nullPackedMaterial` | Cannot create a matcap material buffer descriptor from null packed material data. | —    | `packages/webgpu/src/materials/matcap/matcap-material-buffer.ts` |

## matcapMaterialGpuBuffer.creationFailed (1)

| Code                                     | Message                                                | Fix? | Emitted from                                                              |
| ---------------------------------------- | ------------------------------------------------------ | ---- | ------------------------------------------------------------------------- |
| `matcapMaterialGpuBuffer.creationFailed` | Failed to create matcap material uniform buffer '…': … | —    | `packages/webgpu/src/materials/matcap/matcap-material-buffer-resource.ts` |

## matcapMaterialGpuBuffer.nullDescriptorPlan (1)

| Code                                         | Message                                                                 | Fix? | Emitted from                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `matcapMaterialGpuBuffer.nullDescriptorPlan` | Cannot create a matcap material GPU buffer from a null descriptor plan. | —    | `packages/webgpu/src/materials/matcap/matcap-material-buffer-resource.ts` |

## matcapMaterialPack.missingSamplerHandle (1)

| Code                                      | Message                                                   | Fix? | Emitted from                                                     |
| ----------------------------------------- | --------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `matcapMaterialPack.missingSamplerHandle` | Matcap material packing requires a matcap sampler handle. | —    | `packages/webgpu/src/materials/matcap/matcap-material-buffer.ts` |

## matcapMaterialPack.missingTextureHandle (1)

| Code                                      | Message                                                   | Fix? | Emitted from                                                     |
| ----------------------------------------- | --------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `matcapMaterialPack.missingTextureHandle` | Matcap material packing requires a matcap texture handle. | —    | `packages/webgpu/src/materials/matcap/matcap-material-buffer.ts` |

## matcapMaterialPack.unsupportedMaterialKind (1)

| Code                                         | Message                                                   | Fix? | Emitted from                                                     |
| -------------------------------------------- | --------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `matcapMaterialPack.unsupportedMaterialKind` | Matcap material packing requires a matcap texture handle. | —    | `packages/webgpu/src/materials/matcap/matcap-material-buffer.ts` |

## matcapPipeline.missingBatchKeyField (1)

| Code                                  | Message                                                   | Fix? | Emitted from                                                         |
| ------------------------------------- | --------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `matcapPipeline.missingBatchKeyField` | Matcap pipeline descriptor planning requires a batch key. | —    | `packages/webgpu/src/materials/matcap/matcap-pipeline-descriptor.ts` |

## matcapPipeline.missingColorFormat (1)

| Code                                | Message                                                      | Fix? | Emitted from                                                         |
| ----------------------------------- | ------------------------------------------------------------ | ---- | -------------------------------------------------------------------- |
| `matcapPipeline.missingColorFormat` | Matcap pipeline descriptor planning requires a color format. | —    | `packages/webgpu/src/materials/matcap/matcap-pipeline-descriptor.ts` |

## matcapPipeline.missingShaderMetadata (1)

| Code                                   | Message                                                      | Fix? | Emitted from                                                         |
| -------------------------------------- | ------------------------------------------------------------ | ---- | -------------------------------------------------------------------- |
| `matcapPipeline.missingShaderMetadata` | Matcap pipeline descriptor planning requires a color format. | —    | `packages/webgpu/src/materials/matcap/matcap-pipeline-descriptor.ts` |

## matcapPipeline.unsupportedShaderFamily (1)

| Code                                     | Message                                                                                 | Fix? | Emitted from                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `matcapPipeline.unsupportedShaderFamily` | Matcap pipeline descriptor planning requires a 'matcap' material pipeline key, not '…'. | —    | `packages/webgpu/src/materials/matcap/matcap-pipeline-descriptor.ts` |

## matcapPipeline.unsupportedTopology (1)

| Code                                 | Message                                                           | Fix? | Emitted from                                                         |
| ------------------------------------ | ----------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `matcapPipeline.unsupportedTopology` | MatcapMaterial pipeline supports triangle-list topology, not '…'. | —    | `packages/webgpu/src/materials/matcap/matcap-pipeline-descriptor.ts` |

## matcapRenderPipeline.createRenderPipelineUnavailable (1)

| Code                                                   | Message                                                | Fix? | Emitted from                                              |
| ------------------------------------------------------ | ------------------------------------------------------ | ---- | --------------------------------------------------------- |
| `matcapRenderPipeline.createRenderPipelineUnavailable` | WebGPU device cannot create matcap material pipelines. | —    | `packages/webgpu/src/materials/matcap/matcap-pipeline.ts` |

## matcapRenderPipeline.descriptorPlanFailed (1)

| Code                                        | Message                       | Fix? | Emitted from                                              |
| ------------------------------------------- | ----------------------------- | ---- | --------------------------------------------------------- |
| `matcapRenderPipeline.descriptorPlanFailed` | (message composed at runtime) | —    | `packages/webgpu/src/materials/matcap/matcap-pipeline.ts` |

## matcapRenderPipeline.pipelineCreationFailed (1)

| Code                                          | Message                       | Fix? | Emitted from                                              |
| --------------------------------------------- | ----------------------------- | ---- | --------------------------------------------------------- |
| `matcapRenderPipeline.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/materials/matcap/matcap-pipeline.ts` |

## matcapRenderPipeline.shaderCreationFailed (1)

| Code                                        | Message                                                | Fix? | Emitted from                                              |
| ------------------------------------------- | ------------------------------------------------------ | ---- | --------------------------------------------------------- |
| `matcapRenderPipeline.shaderCreationFailed` | WebGPU device cannot create matcap material pipelines. | —    | `packages/webgpu/src/materials/matcap/matcap-pipeline.ts` |

## matcapRenderPipeline.shaderDiagnostic (1)

| Code                                    | Message                       | Fix? | Emitted from                                              |
| --------------------------------------- | ----------------------------- | ---- | --------------------------------------------------------- |
| `matcapRenderPipeline.shaderDiagnostic` | (message composed at runtime) | —    | `packages/webgpu/src/materials/matcap/matcap-pipeline.ts` |

## material.incompatibleRenderState (1)

| Code                               | Message                                    | Fix? | Emitted from                                  |
| ---------------------------------- | ------------------------------------------ | ---- | --------------------------------------------- |
| `material.incompatibleRenderState` | Blend materials must disable depth writes. | —    | `packages/render/src/materials/validation.ts` |

## material.invalidAlphaCutoff (1)

| Code                          | Message                               | Fix? | Emitted from                                  |
| ----------------------------- | ------------------------------------- | ---- | --------------------------------------------- |
| `material.invalidAlphaCutoff` | Alpha cutoff must be between 0 and 1. | —    | `packages/render/src/materials/validation.ts` |

## material.invalidTextureColorSpace (1)

| Code                                | Message                               | Fix? | Emitted from                                  |
| ----------------------------------- | ------------------------------------- | ---- | --------------------------------------------- |
| `material.invalidTextureColorSpace` | Alpha cutoff must be between 0 and 1. | —    | `packages/render/src/materials/validation.ts` |

## material.invalidTextureColorSpaceFormat (1)

| Code                                      | Message                               | Fix? | Emitted from                                  |
| ----------------------------------------- | ------------------------------------- | ---- | --------------------------------------------- |
| `material.invalidTextureColorSpaceFormat` | Alpha cutoff must be between 0 and 1. | —    | `packages/render/src/materials/validation.ts` |

## material.missingSamplerHandle (1)

| Code                            | Message                        | Fix? | Emitted from                                  |
| ------------------------------- | ------------------------------ | ---- | --------------------------------------------- |
| `material.missingSamplerHandle` | … is missing a sampler handle. | —    | `packages/render/src/materials/validation.ts` |

## material.missingTextureHandle (1)

| Code                            | Message                        | Fix? | Emitted from                                  |
| ------------------------------- | ------------------------------ | ---- | --------------------------------------------- |
| `material.missingTextureHandle` | … is missing a texture handle. | —    | `packages/render/src/materials/validation.ts` |

## material.unsupportedFeature (1)

| Code                          | Message                           | Fix? | Emitted from                                  |
| ----------------------------- | --------------------------------- | ---- | --------------------------------------------- |
| `material.unsupportedFeature` | MVP materials do not support '…'. | —    | `packages/render/src/materials/validation.ts` |

## materialDependency.materialNotReady (1)

| Code                                  | Message                         | Fix? | Emitted from                                            |
| ------------------------------------- | ------------------------------- | ---- | ------------------------------------------------------- |
| `materialDependency.materialNotReady` | Material '…' is '…', not ready. | —    | `packages/render/src/materials/dependency-readiness.ts` |

## materialDependency.missingMaterial (1)

| Code                                 | Message                         | Fix? | Emitted from                                            |
| ------------------------------------ | ------------------------------- | ---- | ------------------------------------------------------- |
| `materialDependency.missingMaterial` | Material '…' is not registered. | —    | `packages/render/src/materials/dependency-readiness.ts` |

## materialDependency.missingSamplerResource (1)

| Code                                        | Message                       | Fix? | Emitted from                                                          |
| ------------------------------------------- | ----------------------------- | ---- | --------------------------------------------------------------------- |
| `materialDependency.missingSamplerResource` | Missing sampler resource '…'. | —    | `packages/webgpu/src/materials/core/material-dependency-readiness.ts` |

## materialDependency.missingTextureResource (1)

| Code                                        | Message                       | Fix? | Emitted from                                                          |
| ------------------------------------------- | ----------------------------- | ---- | --------------------------------------------------------------------- |
| `materialDependency.missingTextureResource` | Missing texture resource '…'. | —    | `packages/webgpu/src/materials/core/material-dependency-readiness.ts` |

## materialPack.missingSamplerHandle (1)

| Code                                | Message                                                       | Fix? | Emitted from                                     |
| ----------------------------------- | ------------------------------------------------------------- | ---- | ------------------------------------------------ |
| `materialPack.missingSamplerHandle` | Unlit base color texture binding is missing a sampler handle. | —    | `packages/render/src/materials/unlit-packing.ts` |

## materialPack.missingTextureHandle (1)

| Code                                | Message                                                       | Fix? | Emitted from                                     |
| ----------------------------------- | ------------------------------------------------------------- | ---- | ------------------------------------------------ |
| `materialPack.missingTextureHandle` | Unlit base color texture binding is missing a texture handle. | —    | `packages/render/src/materials/unlit-packing.ts` |

## materialPack.unsupportedMaterialKind (1)

| Code                                   | Message                                                | Fix? | Emitted from                                     |
| -------------------------------------- | ------------------------------------------------------ | ---- | ------------------------------------------------ |
| `materialPack.unsupportedMaterialKind` | Unlit material packing does not support '…' materials. | —    | `packages/render/src/materials/unlit-packing.ts` |

## materialQueue.missingPreparedResource (1)

| Code                                    | Message                       | Fix? | Emitted from                                      |
| --------------------------------------- | ----------------------------- | ---- | ------------------------------------------------- |
| `materialQueue.missingPreparedResource` | (message composed at runtime) | —    | `packages/render/src/rendering/material-queue.ts` |

## materialQueue.unknownMaterialFamily (1)

| Code                                  | Message                                                               | Fix? | Emitted from                                      |
| ------------------------------------- | --------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| `materialQueue.unknownMaterialFamily` | Render object … uses unsupported material family in pipeline key '…'. | —    | `packages/render/src/rendering/material-queue.ts` |

## mesh.invalidSubmeshRange (1)

| Code                       | Message                                                      | Fix? | Emitted from                             |
| -------------------------- | ------------------------------------------------------------ | ---- | ---------------------------------------- |
| `mesh.invalidSubmeshRange` | Submesh vertex or index range is outside mesh buffer bounds. | —    | `packages/render/src/mesh/validation.ts` |

## mesh.missingBounds (1)

| Code                 | Message                                                   | Fix? | Emitted from                             |
| -------------------- | --------------------------------------------------------- | ---- | ---------------------------------------- |
| `mesh.missingBounds` | Mesh asset is missing local AABB or bounding sphere data. | —    | `packages/render/src/mesh/validation.ts` |

## mesh.missingMaterialSlot (1)

| Code                       | Message                                                      | Fix? | Emitted from                             |
| -------------------------- | ------------------------------------------------------------ | ---- | ---------------------------------------- |
| `mesh.missingMaterialSlot` | Submesh vertex or index range is outside mesh buffer bounds. | —    | `packages/render/src/mesh/validation.ts` |

## mesh.missingPosition (1)

| Code                   | Message                                                          | Fix? | Emitted from                             |
| ---------------------- | ---------------------------------------------------------------- | ---- | ---------------------------------------- |
| `mesh.missingPosition` | Renderable mesh assets must include a POSITION vertex attribute. | —    | `packages/render/src/mesh/validation.ts` |

## mesh.unsupportedTopology (1)

| Code                       | Message                                                      | Fix? | Emitted from                             |
| -------------------------- | ------------------------------------------------------------ | ---- | ---------------------------------------- |
| `mesh.unsupportedTopology` | Submesh vertex or index range is outside mesh buffer bounds. | —    | `packages/render/src/mesh/validation.ts` |

## meshBuffer.emptyVertexUploads (1)

| Code                            | Message                                           | Fix? | Emitted from                                                      |
| ------------------------------- | ------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `meshBuffer.emptyVertexUploads` | Mesh upload plan has no vertex streams to upload. | —    | `packages/webgpu/src/resources/meshes/mesh-buffer-descriptors.ts` |

## meshBuffer.invalidUsageFlags (1)

| Code                           | Message                                               | Fix? | Emitted from                                                      |
| ------------------------------ | ----------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `meshBuffer.invalidUsageFlags` | Vertex buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/meshes/mesh-buffer-descriptors.ts` |

## meshBuffer.nullPlan (1)

| Code                  | Message                                                        | Fix? | Emitted from                                                      |
| --------------------- | -------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `meshBuffer.nullPlan` | Cannot create mesh buffer descriptors from a null upload plan. | —    | `packages/webgpu/src/resources/meshes/mesh-buffer-descriptors.ts` |

## meshGpuBuffer.indexCreationFailed (1)

| Code                                | Message                              | Fix? | Emitted from                                                    |
| ----------------------------------- | ------------------------------------ | ---- | --------------------------------------------------------------- |
| `meshGpuBuffer.indexCreationFailed` | Failed to create index buffer '…': … | —    | `packages/webgpu/src/resources/meshes/mesh-buffer-resources.ts` |

## meshGpuBuffer.nullDescriptorPlan (1)

| Code                               | Message                                                     | Fix? | Emitted from                                                    |
| ---------------------------------- | ----------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `meshGpuBuffer.nullDescriptorPlan` | Cannot create mesh GPU buffers from a null descriptor plan. | —    | `packages/webgpu/src/resources/meshes/mesh-buffer-resources.ts` |

## meshGpuBuffer.vertexCreationFailed (1)

| Code                                 | Message                               | Fix? | Emitted from                                                    |
| ------------------------------------ | ------------------------------------- | ---- | --------------------------------------------------------------- |
| `meshGpuBuffer.vertexCreationFailed` | Failed to create vertex buffer '…': … | —    | `packages/webgpu/src/resources/meshes/mesh-buffer-resources.ts` |

## meshMerge.emptyInput (1)

| Code                   | Message                                                | Fix? | Emitted from                                  |
| ---------------------- | ------------------------------------------------------ | ---- | --------------------------------------------- |
| `meshMerge.emptyInput` | Cannot merge mesh assets for batching without sources. | —    | `packages/render/src/rendering/mesh-merge.ts` |

## meshMerge.incompatibleIndexPresence (1)

| Code                                  | Message                                                    | Fix? | Emitted from                                             |
| ------------------------------------- | ---------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `meshMerge.incompatibleIndexPresence` | Source mesh '…' submesh … uses '…' topology; expected '…'. | —    | `packages/render/src/rendering/mesh-merge-validation.ts` |

## meshMerge.incompatibleMaterialSlots (1)

| Code                                  | Message                                                           | Fix? | Emitted from                                             |
| ------------------------------------- | ----------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `meshMerge.incompatibleMaterialSlots` | Source mesh '…' material slots do not match the first batch mesh. | —    | `packages/render/src/rendering/mesh-merge-validation.ts` |

## meshMerge.incompatibleTopology (1)

| Code                             | Message                                                    | Fix? | Emitted from                                             |
| -------------------------------- | ---------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `meshMerge.incompatibleTopology` | Source mesh '…' submesh … uses '…' topology; expected '…'. | —    | `packages/render/src/rendering/mesh-merge-validation.ts` |

## meshMerge.incompatibleVertexStreamCount (1)

| Code                                      | Message                                           | Fix? | Emitted from                                             |
| ----------------------------------------- | ------------------------------------------------- | ---- | -------------------------------------------------------- |
| `meshMerge.incompatibleVertexStreamCount` | Source mesh '…' has … vertex streams; expected …. | —    | `packages/render/src/rendering/mesh-merge-validation.ts` |

## meshMerge.incompatibleVertexStreamData (1)

| Code                                     | Message                                                                                 | Fix? | Emitted from                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `meshMerge.incompatibleVertexStreamData` | Source mesh '…' vertex stream '…' data does not cover … vertices at … bytes per vertex. | —    | `packages/render/src/rendering/mesh-merge-validation.ts` |

## meshMerge.incompatibleVertexStreamLayout (1)

| Code                                       | Message                                                                       | Fix? | Emitted from                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `meshMerge.incompatibleVertexStreamLayout` | Source mesh '…' vertex stream '…' does not match the first batch mesh layout. | —    | `packages/render/src/rendering/mesh-merge-validation.ts` |

## meshMerge.invalidIndexRange (1)

| Code                          | Message                                                         | Fix? | Emitted from                                           |
| ----------------------------- | --------------------------------------------------------------- | ---- | ------------------------------------------------------ |
| `meshMerge.invalidIndexRange` | Source mesh '…' index … references vertex … outside … vertices. | —    | `packages/render/src/rendering/mesh-merge-assembly.ts` |

## meshMerge.invalidSourceMesh (1)

| Code                          | Message                                    | Fix? | Emitted from                                             |
| ----------------------------- | ------------------------------------------ | ---- | -------------------------------------------------------- |
| `meshMerge.invalidSourceMesh` | Source mesh '…' is invalid for batching: … | —    | `packages/render/src/rendering/mesh-merge-validation.ts` |

## meshUpload.invalidIndexData (1)

| Code                          | Message                                                       | Fix? | Emitted from                              |
| ----------------------------- | ------------------------------------------------------------- | ---- | ----------------------------------------- |
| `meshUpload.invalidIndexData` | Index buffer data is missing or incompatible with '…' format. | —    | `packages/render/src/mesh/upload-plan.ts` |

## meshUpload.invalidUpdateRange (1)

| Code                            | Message                                                                          | Fix? | Emitted from                              |
| ------------------------------- | -------------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `meshUpload.invalidUpdateRange` | Mesh update ranges must be 4-byte aligned byte windows inside the source buffer. | —    | `packages/render/src/mesh/upload-plan.ts` |

## meshUpload.invalidVertexStreamData (1)

| Code                                 | Message                                                                 | Fix? | Emitted from                              |
| ------------------------------------ | ----------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `meshUpload.invalidVertexStreamData` | Vertex stream '…' data does not cover … vertices at … bytes per vertex. | —    | `packages/render/src/mesh/upload-plan.ts` |

## meshUpload.missingVertexStreamData (1)

| Code                                 | Message                                   | Fix? | Emitted from                              |
| ------------------------------------ | ----------------------------------------- | ---- | ----------------------------------------- |
| `meshUpload.missingVertexStreamData` | Vertex stream '…' is missing source data. | —    | `packages/render/src/mesh/upload-plan.ts` |

## morphInstanceDescriptorBuffer.invalidUsageFlags (1)

| Code                                              | Message                                                                          | Fix? | Emitted from                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `morphInstanceDescriptorBuffer.invalidUsageFlags` | Morph instance descriptor storage-buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/attributes/morph-instance-descriptor-buffer.ts` |

## morphInstanceDescriptorBuffer.missingData (1)

| Code                                        | Message                                                                             | Fix? | Emitted from                                                                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `morphInstanceDescriptorBuffer.missingData` | Standard frame GPU resource creation requires a draw packet for a morphed pipeline. | —    | `packages/webgpu/src/materials/standard/standard-frame-base-resources.ts`<br>`packages/webgpu/src/resources/attributes/morph-instance-descriptor-buffer.ts` |

## morphInstanceDescriptorBuffer.notMorphed (1)

| Code                                       | Message                                                                          | Fix? | Emitted from                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `morphInstanceDescriptorBuffer.notMorphed` | Morph instance descriptor storage-buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/attributes/morph-instance-descriptor-buffer.ts` |

## morphInstanceDescriptorGpuBuffer.creationFailed (1)

| Code                                              | Message                                                  | Fix? | Emitted from                                                                   |
| ------------------------------------------------- | -------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `morphInstanceDescriptorGpuBuffer.creationFailed` | Failed to create morph instance descriptor buffer '…': … | —    | `packages/webgpu/src/resources/attributes/morph-instance-descriptor-buffer.ts` |

## morphInstanceDescriptorGpuBuffer.nullDescriptorPlan (1)

| Code                                                  | Message                                                                           | Fix? | Emitted from                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `morphInstanceDescriptorGpuBuffer.nullDescriptorPlan` | Cannot create a morph instance descriptor GPU buffer from a null descriptor plan. | —    | `packages/webgpu/src/resources/attributes/morph-instance-descriptor-buffer.ts` |

## morphTargetDeltaBuffer.invalidUsageFlags (1)

| Code                                       | Message                                                                   | Fix? | Emitted from                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `morphTargetDeltaBuffer.invalidUsageFlags` | Morph target delta storage-buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/attributes/morph-target-delta-buffer.ts` |

## morphTargetDeltaBuffer.missingData (1)

| Code                                 | Message                                                                             | Fix? | Emitted from                                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `morphTargetDeltaBuffer.missingData` | Standard frame GPU resource creation requires a draw packet for a morphed pipeline. | —    | `packages/webgpu/src/materials/standard/standard-frame-base-resources.ts`<br>`packages/webgpu/src/resources/attributes/morph-target-delta-buffer.ts` |

## morphTargetDeltaBuffer.notMorphed (1)

| Code                                | Message                                                                   | Fix? | Emitted from                                                            |
| ----------------------------------- | ------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `morphTargetDeltaBuffer.notMorphed` | Morph target delta storage-buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/attributes/morph-target-delta-buffer.ts` |

## morphTargetDeltaGpuBuffer.creationFailed (1)

| Code                                       | Message                                           | Fix? | Emitted from                                                            |
| ------------------------------------------ | ------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `morphTargetDeltaGpuBuffer.creationFailed` | Failed to create morph target delta buffer '…': … | —    | `packages/webgpu/src/resources/attributes/morph-target-delta-buffer.ts` |

## morphTargetDeltaGpuBuffer.nullDescriptorPlan (1)

| Code                                           | Message                                                                    | Fix? | Emitted from                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `morphTargetDeltaGpuBuffer.nullDescriptorPlan` | Cannot create a morph target delta GPU buffer from a null descriptor plan. | —    | `packages/webgpu/src/resources/attributes/morph-target-delta-buffer.ts` |

## morphTargetWeightBuffer.invalidUsageFlags (1)

| Code                                        | Message                                                                    | Fix? | Emitted from                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `morphTargetWeightBuffer.invalidUsageFlags` | Morph target weight storage-buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/attributes/morph-target-weight-buffer.ts` |

## morphTargetWeightBuffer.missingData (1)

| Code                                  | Message                                                                             | Fix? | Emitted from                                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `morphTargetWeightBuffer.missingData` | Standard frame GPU resource creation requires a draw packet for a morphed pipeline. | —    | `packages/webgpu/src/materials/standard/standard-frame-base-resources.ts`<br>`packages/webgpu/src/resources/attributes/morph-target-weight-buffer.ts` |

## morphTargetWeightBuffer.notMorphed (1)

| Code                                 | Message                                                                    | Fix? | Emitted from                                                             |
| ------------------------------------ | -------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `morphTargetWeightBuffer.notMorphed` | Morph target weight storage-buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/attributes/morph-target-weight-buffer.ts` |

## morphTargetWeightGpuBuffer.creationFailed (1)

| Code                                        | Message                                            | Fix? | Emitted from                                                             |
| ------------------------------------------- | -------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `morphTargetWeightGpuBuffer.creationFailed` | Failed to create morph target weight buffer '…': … | —    | `packages/webgpu/src/resources/attributes/morph-target-weight-buffer.ts` |

## morphTargetWeightGpuBuffer.nullDescriptorPlan (1)

| Code                                            | Message                                                                     | Fix? | Emitted from                                                             |
| ----------------------------------------------- | --------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `morphTargetWeightGpuBuffer.nullDescriptorPlan` | Cannot create a morph target weight GPU buffer from a null descriptor plan. | —    | `packages/webgpu/src/resources/attributes/morph-target-weight-buffer.ts` |

## msdfFont.duplicateGlyph (1)

| Code                      | Message                                    | Fix? | Emitted from                                  |
| ------------------------- | ------------------------------------------ | ---- | --------------------------------------------- |
| `msdfFont.duplicateGlyph` | Duplicate MSDF glyph '…' (…) in atlas '…'. | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfFont.invalidAtlasDimensions (1)

| Code                              | Message                                                                              | Fix? | Emitted from                                  |
| --------------------------------- | ------------------------------------------------------------------------------------ | ---- | --------------------------------------------- |
| `msdfFont.invalidAtlasDimensions` | MSDF font atlas requires finite positive common.scaleW and common.scaleH dimensions. | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfFont.invalidDistanceRange (1)

| Code                            | Message                                                    | Fix? | Emitted from                                  |
| ------------------------------- | ---------------------------------------------------------- | ---- | --------------------------------------------- |
| `msdfFont.invalidDistanceRange` | MSDF font atlas distanceRange must be finite and positive. | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfFont.invalidFontSize (1)

| Code                       | Message                                                                  | Fix? | Emitted from                                  |
| -------------------------- | ------------------------------------------------------------------------ | ---- | --------------------------------------------- |
| `msdfFont.invalidFontSize` | MSDF font atlas requires finite positive fontSize and lineHeight values. | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfFont.invalidGlyphBounds (1)

| Code                          | Message                                              | Fix? | Emitted from                                  |
| ----------------------------- | ---------------------------------------------------- | ---- | --------------------------------------------- |
| `msdfFont.invalidGlyphBounds` | MSDF glyph '…' bounds must fit inside the …x… atlas. | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfFont.invalidGlyphPage (1)

| Code                        | Message                                                                | Fix? | Emitted from                                  |
| --------------------------- | ---------------------------------------------------------------------- | ---- | --------------------------------------------- |
| `msdfFont.invalidGlyphPage` | MSDF glyph '…' references page …, but atlas '…' has … texture page(s). | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfFont.missingGlyphs (1)

| Code                     | Message                                             | Fix? | Emitted from                                  |
| ------------------------ | --------------------------------------------------- | ---- | --------------------------------------------- |
| `msdfFont.missingGlyphs` | MSDF font atlas requires at least one glyph record. | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfFont.pageCountMismatch (1)

| Code                         | Message                                               | Fix? | Emitted from                                  |
| ---------------------------- | ----------------------------------------------------- | ---- | --------------------------------------------- |
| `msdfFont.pageCountMismatch` | MSDF text layout requires a finite positive fontSize. | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfFont.texturePageMismatch (1)

| Code                           | Message                                                                   | Fix? | Emitted from                                  |
| ------------------------------ | ------------------------------------------------------------------------- | ---- | --------------------------------------------- |
| `msdfFont.texturePageMismatch` | MSDF font atlas declares … page name(s) but received … texture handle(s). | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfText.invalidFontSize (1)

| Code                       | Message                                               | Fix? | Emitted from                                  |
| -------------------------- | ----------------------------------------------------- | ---- | --------------------------------------------- |
| `msdfText.invalidFontSize` | MSDF text layout requires a finite positive fontSize. | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfText.invalidMaxWidth (1)

| Code                       | Message                                                   | Fix? | Emitted from                                  |
| -------------------------- | --------------------------------------------------------- | ---- | --------------------------------------------- |
| `msdfText.invalidMaxWidth` | MSDF text layout maxWidth must be positive when provided. | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfText.missingGlyph (1)

| Code                    | Message                             | Fix? | Emitted from                                  |
| ----------------------- | ----------------------------------- | ---- | --------------------------------------------- |
| `msdfText.missingGlyph` | MSDF font '…' has no glyph for '…'. | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfText.unsupportedShaping (1)

| Code                          | Message                                                                                                                                  | Fix? | Emitted from                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------- |
| `msdfText.unsupportedShaping` | M6 MSDF text supports basic left-to-right glyph layout only; complex shaping, bidi, and combining marks are not supported in this slice. | —    | `packages/render/src/text/msdf-font-atlas.ts` |

## msdfTextFrame.createBindGroupUnavailable (1)

| Code                                       | Message                                            | Fix? | Emitted from                      |
| ------------------------------------------ | -------------------------------------------------- | ---- | --------------------------------- |
| `msdfTextFrame.createBindGroupUnavailable` | WebGPU device cannot create MSDF text bind groups. | —    | `packages/webgpu/src/app/text.ts` |

## msdfTextFrame.missingPipelineLayouts (1)

| Code                                   | Message                                                | Fix? | Emitted from                      |
| -------------------------------------- | ------------------------------------------------------ | ---- | --------------------------------- |
| `msdfTextFrame.missingPipelineLayouts` | MSDF text pipeline does not expose bind group layouts. | —    | `packages/webgpu/src/app/text.ts` |

## msdfTextFrame.missingQuadBuffers (1)

| Code                               | Message                                                | Fix? | Emitted from                      |
| ---------------------------------- | ------------------------------------------------------ | ---- | --------------------------------- |
| `msdfTextFrame.missingQuadBuffers` | MSDF text glyph batches require quad snapshot buffers. | —    | `packages/webgpu/src/app/text.ts` |

## msdfTextFrame.quadBatchMissingTexture (1)

| Code                                    | Message                                                     | Fix? | Emitted from                      |
| --------------------------------------- | ----------------------------------------------------------- | ---- | --------------------------------- |
| `msdfTextFrame.quadBatchMissingTexture` | MSDF text quad batch … is missing its atlas texture handle. | —    | `packages/webgpu/src/app/text.ts` |

## msdfTextRenderPipeline.createRenderPipelineUnavailable (1)

| Code                                                     | Message                                                 | Fix? | Emitted from                                            |
| -------------------------------------------------------- | ------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `msdfTextRenderPipeline.createRenderPipelineUnavailable` | WebGPU device cannot create MSDF text render pipelines. | —    | `packages/webgpu/src/render/text/msdf-text-pipeline.ts` |

## msdfTextRenderPipeline.pipelineCreationFailed (1)

| Code                                            | Message                       | Fix? | Emitted from                                            |
| ----------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------- |
| `msdfTextRenderPipeline.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/render/text/msdf-text-pipeline.ts` |

## msdfTextRenderPipeline.shaderCreationFailed (1)

| Code                                          | Message                                                 | Fix? | Emitted from                                            |
| --------------------------------------------- | ------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `msdfTextRenderPipeline.shaderCreationFailed` | WebGPU device cannot create MSDF text render pipelines. | —    | `packages/webgpu/src/render/text/msdf-text-pipeline.ts` |

## msdfTextRenderPipeline.shaderDiagnostic (1)

| Code                                      | Message                       | Fix? | Emitted from                                            |
| ----------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------- |
| `msdfTextRenderPipeline.shaderDiagnostic` | (message composed at runtime) | —    | `packages/webgpu/src/render/text/msdf-text-pipeline.ts` |

## mvpFrameReadiness.frameBoundaryNotReady (1)

| Code                                      | Message                                        | Fix? | Emitted from                                             |
| ----------------------------------------- | ---------------------------------------------- | ---- | -------------------------------------------------------- |
| `mvpFrameReadiness.frameBoundaryNotReady` | Frame boundary validation report is not ready. | —    | `packages/webgpu/src/diagnostics/mvp-frame-readiness.ts` |

## mvpFrameReadiness.frameSubmissionNotReady (1)

| Code                                        | Message                                     | Fix? | Emitted from                                             |
| ------------------------------------------- | ------------------------------------------- | ---- | -------------------------------------------------------- |
| `mvpFrameReadiness.frameSubmissionNotReady` | Frame submission smoke report is not ready. | —    | `packages/webgpu/src/diagnostics/mvp-frame-readiness.ts` |

## mvpFrameReadiness.rendererAssemblyNotReady (1)

| Code                                         | Message                                      | Fix? | Emitted from                                             |
| -------------------------------------------- | -------------------------------------------- | ---- | -------------------------------------------------------- |
| `mvpFrameReadiness.rendererAssemblyNotReady` | Renderer assembly smoke report is not ready. | —    | `packages/webgpu/src/diagnostics/mvp-frame-readiness.ts` |

## mvpFrameReadiness.renderPassAssemblyNotReady (1)

| Code                                           | Message                                         | Fix? | Emitted from                                             |
| ---------------------------------------------- | ----------------------------------------------- | ---- | -------------------------------------------------------- |
| `mvpFrameReadiness.renderPassAssemblyNotReady` | Render pass assembly smoke report is not ready. | —    | `packages/webgpu/src/diagnostics/mvp-frame-readiness.ts` |

## particle.invalidBounds (1)

| Code                     | Message                                                                                                       | Fix? | Emitted from                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `particle.invalidBounds` | Particle emitter bounds require a finite center and a non-negative radius; radius 0 enables automatic bounds. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## particle.invalidCapacity (1)

| Code                       | Message                                                       | Fix? | Emitted from                                                    |
| -------------------------- | ------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `particle.invalidCapacity` | Particle emitter capacity must be zero or a positive integer. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## particle.invalidEffect (1)

| Code                     | Message                                             | Fix? | Emitted from                                                    |
| ------------------------ | --------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `particle.invalidEffect` | Particle emitters require a particle-effect handle. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## particle.invalidResetEpoch (1)

| Code                         | Message                                                     | Fix? | Emitted from                                                    |
| ---------------------------- | ----------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `particle.invalidResetEpoch` | Particle emitter resetEpoch must be a non-negative integer. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## particle.invalidSeed (1)

| Code                   | Message                                   | Fix? | Emitted from                                                    |
| ---------------------- | ----------------------------------------- | ---- | --------------------------------------------------------------- |
| `particle.invalidSeed` | Particle emitter seed must be an integer. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## particle.invalidSimulationSpace (1)

| Code                              | Message                                                      | Fix? | Emitted from                                                    |
| --------------------------------- | ------------------------------------------------------------ | ---- | --------------------------------------------------------------- |
| `particle.invalidSimulationSpace` | Particle emitter simulationSpace must be 'world' or 'local'. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## particle.invalidTimeScale (1)

| Code                        | Message                                                   | Fix? | Emitted from                                                    |
| --------------------------- | --------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `particle.invalidTimeScale` | Particle emitter timeScale must be a non-negative number. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## particleEffect.partiallySupportedFeature (1)

| Code                                       | Message                                                                                                                 | Fix? | Emitted from                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `particleEffect.partiallySupportedFeature` | Particle lifetime ranges are honored by worker-emitted bursts; continuous GPU emitters currently use lifetime.max only. | —    | `packages/render/src/assets/particles.ts` |

## particleEffect.unsupportedFeature (1)

| Code                                | Message                                                                                                                                         | Fix? | Emitted from                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `particleEffect.unsupportedFeature` | Particle texture atlas animation is not implemented yet; atlasFrameCount values above 1 are accepted for authoring but ignored by the renderer. | —    | `packages/render/src/assets/particles.ts` |

## particleFrame.beginComputeFailed (1)

| Code                               | Message                                | Fix? | Emitted from                           |
| ---------------------------------- | -------------------------------------- | ---- | -------------------------------------- |
| `particleFrame.beginComputeFailed` | Particle compute pass could not begin. | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.burstBatchBufferFailed (1)

| Code                                   | Message                       | Fix? | Emitted from                           |
| -------------------------------------- | ----------------------------- | ---- | -------------------------------------- |
| `particleFrame.burstBatchBufferFailed` | (message composed at runtime) | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.burstBatchSlotUnavailable (1)

| Code                                      | Message                                                            | Fix? | Emitted from                           |
| ----------------------------------------- | ------------------------------------------------------------------ | ---- | -------------------------------------- |
| `particleFrame.burstBatchSlotUnavailable` | Particle burst batch did not have enough contiguous slot capacity. | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.burstBatchUnavailable (1)

| Code                                  | Message                                                             | Fix? | Emitted from                           |
| ------------------------------------- | ------------------------------------------------------------------- | ---- | -------------------------------------- |
| `particleFrame.burstBatchUnavailable` | Particle burst batching requires bind groups and queue.writeBuffer. | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.burstParamBufferFailed (1)

| Code                                   | Message                       | Fix? | Emitted from                           |
| -------------------------------------- | ----------------------------- | ---- | -------------------------------------- |
| `particleFrame.burstParamBufferFailed` | (message composed at runtime) | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.burstParamBufferMissing (1)

| Code                                    | Message                                               | Fix? | Emitted from                           |
| --------------------------------------- | ----------------------------------------------------- | ---- | -------------------------------------- |
| `particleFrame.burstParamBufferMissing` | Particle burst render params did not return a buffer. | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.burstParamWriteUnavailable (1)

| Code                                       | Message                                                 | Fix? | Emitted from                           |
| ------------------------------------------ | ------------------------------------------------------- | ---- | -------------------------------------- |
| `particleFrame.burstParamWriteUnavailable` | Particle burst render params require queue.writeBuffer. | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.burstStateMissing (1)

| Code                              | Message                                            | Fix? | Emitted from                           |
| --------------------------------- | -------------------------------------------------- | ---- | -------------------------------------- |
| `particleFrame.burstStateMissing` | Particle burst packet is missing burst parameters. | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.burstWriteBufferUnavailable (1)

| Code                                        | Message                                               | Fix? | Emitted from                           |
| ------------------------------------------- | ----------------------------------------------------- | ---- | -------------------------------------- |
| `particleFrame.burstWriteBufferUnavailable` | Particle burst simulation requires queue.writeBuffer. | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.effectNotReady (1)

| Code                           | Message                           | Fix? | Emitted from                           |
| ------------------------------ | --------------------------------- | ---- | -------------------------------------- |
| `particleFrame.effectNotReady` | Particle effect '…' is not ready. | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.missingBindGroupSupport (1)

| Code                                    | Message                                                            | Fix? | Emitted from                           |
| --------------------------------------- | ------------------------------------------------------------------ | ---- | -------------------------------------- |
| `particleFrame.missingBindGroupSupport` | Particle frame resources require bind groups and pipeline layouts. | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.paramBufferFailed (1)

| Code                              | Message                       | Fix? | Emitted from                           |
| --------------------------------- | ----------------------------- | ---- | -------------------------------------- |
| `particleFrame.paramBufferFailed` | (message composed at runtime) | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.stateBufferFailed (1)

| Code                              | Message                       | Fix? | Emitted from                           |
| --------------------------------- | ----------------------------- | ---- | -------------------------------------- |
| `particleFrame.stateBufferFailed` | (message composed at runtime) | —    | `packages/webgpu/src/app/particles.ts` |

## particleFrame.viewBufferFailed (1)

| Code                             | Message                       | Fix? | Emitted from                           |
| -------------------------------- | ----------------------------- | ---- | -------------------------------------- |
| `particleFrame.viewBufferFailed` | (message composed at runtime) | —    | `packages/webgpu/src/app/particles.ts` |

## particlePipeline.createComputePipelineUnavailable (1)

| Code                                                | Message                                                 | Fix? | Emitted from                                                |
| --------------------------------------------------- | ------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `particlePipeline.createComputePipelineUnavailable` | WebGPU device cannot create particle compute pipelines. | —    | `packages/webgpu/src/render/particles/particle-pipeline.ts` |

## particlePipeline.createRenderPipelineUnavailable (1)

| Code                                               | Message                                                | Fix? | Emitted from                                                |
| -------------------------------------------------- | ------------------------------------------------------ | ---- | ----------------------------------------------------------- |
| `particlePipeline.createRenderPipelineUnavailable` | WebGPU device cannot create particle render pipelines. | —    | `packages/webgpu/src/render/particles/particle-pipeline.ts` |

## particlePipeline.pipelineCreationFailed (1)

| Code                                      | Message                       | Fix? | Emitted from                                                |
| ----------------------------------------- | ----------------------------- | ---- | ----------------------------------------------------------- |
| `particlePipeline.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/render/particles/particle-pipeline.ts` |

## particlePipeline.shaderCreationFailed (1)

| Code                                    | Message                                                 | Fix? | Emitted from                                                |
| --------------------------------------- | ------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `particlePipeline.shaderCreationFailed` | WebGPU device cannot create particle compute pipelines. | —    | `packages/webgpu/src/render/particles/particle-pipeline.ts` |

## particlePipeline.shaderDiagnostic (1)

| Code                                | Message                       | Fix? | Emitted from                                                |
| ----------------------------------- | ----------------------------- | ---- | ----------------------------------------------------------- |
| `particlePipeline.shaderDiagnostic` | (message composed at runtime) | —    | `packages/webgpu/src/render/particles/particle-pipeline.ts` |

## physics.characterController (1)

| Code                                      | Message                                                                                                               | Fix? | Emitted from                        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------- |
| `physics.characterController.unsupported` | The benchmark requested character movement, but the active backend does not expose PhysicsBackend.moveCharacter(...). | yes  | `packages/physics/src/benchmark.ts` |

## physics.collider (9)

| Code                                             | Message                                                                                                                                                                                 | Fix? | Emitted from                                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| `physics.collider.asset.empty`                   | Physics triangle mesh '…' has no triangles to cook.                                                                                                                                     | yes  | `packages/physics/src/collider-geometry.ts`                                                    |
| `physics.collider.asset.invalid`                 | Physics collider asset '…' is not a MeshAsset.                                                                                                                                          | yes  | `packages/app/src/physics-collider-geometry.ts`<br>`packages/physics/src/collider-geometry.ts` |
| `physics.collider.asset.missing`                 | Physics collider mesh '…' is not registered as a source mesh asset.                                                                                                                     | yes  | `packages/app/src/physics-collider-geometry.ts`                                                |
| `physics.collider.asset.notReady`                | Physics collider mesh '…' is '…', not ready.                                                                                                                                            | yes  | `packages/app/src/physics-collider-geometry.ts`                                                |
| `physics.collider.assetShape.unsupported`        | Collider shape '…' is authored, but the active backend does not yet sync asset-backed collider geometry.                                                                                | yes  | `packages/physics-rapier/src/colliders.ts`<br>`packages/physics/src/backend.ts`                |
| `physics.collider.cooking.failed`                | Rapier could not cook convex hull collider geometry '…'.                                                                                                                                | yes  | `packages/physics-rapier/src/colliders.ts`                                                     |
| `physics.collider.dynamicAssetShape.unsupported` | PhysicsJoint.kind is 'generic', but the active backend route does not yet expose a backend-neutral generic constraint axis/mask mapping.                                                | yes  | `packages/physics/src/backend.ts`                                                              |
| `physics.collider.scale.approximated`            | Collider shape '…' has a non-uniform ECS scale that a … cannot represent exactly; the collider uses an enclosing (largest-axis) approximation that may not match the rendered geometry. | yes  | `packages/physics/src/backend.ts`                                                              |
| `physics.collider.scale.unsupported`             | Collider shape '…' is asset-backed and authored with non-unit ECS scale, but this V1 sync path does not silently bake scale into backend collider geometry.                             | yes  | `packages/physics/src/backend.ts`                                                              |

## physics.debugGeometry (1)

| Code                                | Message                                                                                                           | Fix? | Emitted from                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------- |
| `physics.debugGeometry.unsupported` | The benchmark requested debug geometry, but the active backend does not expose PhysicsBackend.debugGeometry(...). | yes  | `packages/physics/src/benchmark.ts` |

## physics.joint (5)

| Code                                        | Message                                                                                                                                                | Fix? | Emitted from                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | --------------------------------- |
| `physics.joint.breakForce.unsupported`      | PhysicsJoint.breakForce is authored on this joint, but the active backend cannot enforce joint break thresholds or emit truthful jointBreak events.    | yes  | `packages/physics/src/backend.ts` |
| `physics.joint.frameB.unsupported`          | PhysicsJoint.frameB is authored on a non-fixed joint, but the active backend cannot encode a paired body-B joint frame for this joint kind.            | yes  | `packages/physics/src/backend.ts` |
| `physics.joint.impulseReadback.unsupported` | The active physics route does not expose native joint impulse readback, so automatic breakForce thresholds cannot be enforced truthfully.              | yes  | `packages/physics/src/backend.ts` |
| `physics.joint.motorMaxForce.unsupported`   | PhysicsJoint.motorMaxForce is authored on this joint, but the active backend cannot enforce motor force limits through the current public adapter API. | yes  | `packages/physics/src/backend.ts` |
| `physics.joint.unsupported`                 | PhysicsJoint.kind is 'generic', but the active backend route does not yet expose a backend-neutral generic constraint axis/mask mapping.               | yes  | `packages/physics/src/backend.ts` |

## physics.rigidBody (2)

| Code                                         | Message                                                                                                                                                                                                                     | Fix? | Emitted from                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------- |
| `physics.rigidBody.ccd.unsupported`          | RigidBody.ccdEnabled is authored on this body, but the active backend does not implement continuous collision detection.                                                                                                    | yes  | `packages/physics/src/backend.ts` |
| `physics.rigidBody.parentedBody.unsupported` | RigidBody is authored on a parented entity whose world pose was not resolvable this step (no resolved WorldTransform, or a degenerate/non-decomposable world matrix), so the body cannot be synced to a backend world pose. | yes  | `packages/physics/src/backend.ts` |

## pipelineCacheIntegration.nullDescriptorPlan (1)

| Code                                          | Message                                                                  | Fix? | Emitted from                                            |
| --------------------------------------------- | ------------------------------------------------------------------------ | ---- | ------------------------------------------------------- |
| `pipelineCacheIntegration.nullDescriptorPlan` | Cannot create or retrieve a render pipeline from a null descriptor plan. | —    | `packages/webgpu/src/gpu/pipeline-cache-integration.ts` |

## pipelineCacheIntegration.pipelineCreationFailed (1)

| Code                                              | Message                       | Fix? | Emitted from                                            |
| ------------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------- |
| `pipelineCacheIntegration.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/gpu/pipeline-cache-integration.ts` |

## pointShadowMatrix.invalidFace (1)

| Code                            | Message                                          | Fix? | Emitted from                                                     |
| ------------------------------- | ------------------------------------------------ | ---- | ---------------------------------------------------------------- |
| `pointShadowMatrix.invalidFace` | Point shadow plan '…' has invalid cube face '…'. | —    | `packages/webgpu/src/shadows/point-shadow-matrix-computation.ts` |

## pointShadowMatrix.missingLightTransform (1)

| Code                                      | Message                                                            | Fix? | Emitted from                                                     |
| ----------------------------------------- | ------------------------------------------------------------------ | ---- | ---------------------------------------------------------------- |
| `pointShadowMatrix.missingLightTransform` | Point shadow plan '…' references missing light transform offset …. | —    | `packages/webgpu/src/shadows/point-shadow-matrix-computation.ts` |

## pointShadowMatrix.missingViewProjectionPlan (1)

| Code                                          | Message                                                                      | Fix? | Emitted from                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `pointShadowMatrix.missingViewProjectionPlan` | Point shadow matrix computation requires cube-face view/projection planning. | —    | `packages/webgpu/src/shadows/point-shadow-matrix-computation.ts` |

## pointShadowMatrix.unsupportedViewProjectionPlan (1)

| Code                                              | Message                                                           | Fix? | Emitted from                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `pointShadowMatrix.unsupportedViewProjectionPlan` | Point shadow matrix computation only supports point shadow plans. | —    | `packages/webgpu/src/shadows/point-shadow-matrix-computation.ts` |

## pointShadowViewProjection.matrixDeferred (1)

| Code                                       | Message                                                                                                 | Fix? | Emitted from                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `pointShadowViewProjection.matrixDeferred` | Point shadow cube-face view/projection keys are planned, but matrix computation is not implemented yet. | —    | `packages/webgpu/src/shadows/point-shadow-view-projection-plan.ts` |

## pointShadowViewProjection.missingLight (1)

| Code                                     | Message                                                | Fix? | Emitted from                                                       |
| ---------------------------------------- | ------------------------------------------------------ | ---- | ------------------------------------------------------------------ |
| `pointShadowViewProjection.missingLight` | Point shadow request '…' references missing light '…'. | —    | `packages/webgpu/src/shadows/point-shadow-view-projection-plan.ts` |

## pointShadowViewProjection.missingPassPlan (1)

| Code                                        | Message                                               | Fix? | Emitted from                                                       |
| ------------------------------------------- | ----------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `pointShadowViewProjection.missingPassPlan` | Point shadow request '…' has no pass plan for face …. | —    | `packages/webgpu/src/shadows/point-shadow-view-projection-plan.ts` |

## pointShadowViewProjection.unsupportedLightKind (1)

| Code                                             | Message                                                         | Fix? | Emitted from                                                       |
| ------------------------------------------------ | --------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `pointShadowViewProjection.unsupportedLightKind` | Point shadow request '…' references unsupported light kind '…'. | —    | `packages/webgpu/src/shadows/point-shadow-view-projection-plan.ts` |

## preparedDebugNormalMaterial.missingLayout (1)

| Code                                        | Message                                                                              | Fix? | Emitted from                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------ |
| `preparedDebugNormalMaterial.missingLayout` | DebugNormal prepared material caching requires a group-2 material bind group layout. | —    | `packages/webgpu/src/materials/debug-normal/prepared-debug-normal-material-cache.ts` |

## preparedDebugNormalMaterial.missingPreparedBindGroup (1)

| Code                                                   | Message                                                                    | Fix? | Emitted from                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| `preparedDebugNormalMaterial.missingPreparedBindGroup` | DebugNormal prepared material caching did not create a group-2 bind group. | —    | `packages/webgpu/src/materials/debug-normal/prepared-debug-normal-material-cache.ts` |

## preparedMatcapMaterial.missingLayout (1)

| Code                                   | Message                                                                         | Fix? | Emitted from                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `preparedMatcapMaterial.missingLayout` | Matcap prepared material caching requires a group-2 material bind group layout. | —    | `packages/webgpu/src/materials/matcap/prepared-matcap-material-cache.ts` |

## preparedMatcapMaterial.missingPreparedBindGroup (1)

| Code                                              | Message                                                               | Fix? | Emitted from                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `preparedMatcapMaterial.missingPreparedBindGroup` | Matcap prepared material caching did not create a group-2 bind group. | —    | `packages/webgpu/src/materials/matcap/prepared-matcap-material-cache.ts` |

## preparedMatcapTextureDependency.missingSamplerHandle (1)

| Code                                                   | Message                                                             | Fix? | Emitted from                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `preparedMatcapTextureDependency.missingSamplerHandle` | Prepared Matcap material resources require a matcap sampler handle. | —    | `packages/webgpu/src/materials/matcap/prepared-matcap-material-cache.ts` |

## preparedMatcapTextureDependency.missingTextureHandle (1)

| Code                                                   | Message                                                             | Fix? | Emitted from                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `preparedMatcapTextureDependency.missingTextureHandle` | Prepared Matcap material resources require a matcap texture handle. | —    | `packages/webgpu/src/materials/matcap/prepared-matcap-material-cache.ts` |

## preparedMatcapTextureDependency.samplerSourceNotReady (1)

| Code                                                    | Message                                                                       | Fix? | Emitted from                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `preparedMatcapTextureDependency.samplerSourceNotReady` | Sampler source asset '…' is not ready for prepared Matcap material resources. | —    | `packages/webgpu/src/materials/matcap/prepared-matcap-material-cache.ts` |

## preparedMatcapTextureDependency.textureSourceNotReady (1)

| Code                                                    | Message                                                                       | Fix? | Emitted from                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `preparedMatcapTextureDependency.textureSourceNotReady` | Texture source asset '…' is not ready for prepared Matcap material resources. | —    | `packages/webgpu/src/materials/matcap/prepared-matcap-material-cache.ts` |

## preparedMaterialResource.invalidMaterial (1)

| Code                                       | Message                       | Fix? | Emitted from                                         |
| ------------------------------------------ | ----------------------------- | ---- | ---------------------------------------------------- |
| `preparedMaterialResource.invalidMaterial` | (message composed at runtime) | —    | `packages/render/src/materials/prepared-resource.ts` |

## preparedMaterialResource.materialNotReady (1)

| Code                                        | Message                         | Fix? | Emitted from                                         |
| ------------------------------------------- | ------------------------------- | ---- | ---------------------------------------------------- |
| `preparedMaterialResource.materialNotReady` | Material '…' is '…', not ready. | —    | `packages/render/src/materials/prepared-resource.ts` |

## preparedMaterialResource.missingMaterial (1)

| Code                                       | Message                         | Fix? | Emitted from                                         |
| ------------------------------------------ | ------------------------------- | ---- | ---------------------------------------------------- |
| `preparedMaterialResource.missingMaterial` | Material '…' is not registered. | —    | `packages/render/src/materials/prepared-resource.ts` |

## preparedMaterialResource.unsupportedMaterialKind (1)

| Code                                               | Message                                                      | Fix? | Emitted from                                         |
| -------------------------------------------------- | ------------------------------------------------------------ | ---- | ---------------------------------------------------- |
| `preparedMaterialResource.unsupportedMaterialKind` | Prepared material resource descriptor expected '…', not '…'. | —    | `packages/render/src/materials/prepared-resource.ts` |

## preparedResourceAppReuse.materialFacadeMismatch (1)

| Code                                              | Message                                                                                    | Fix? | Emitted from                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------- |
| `preparedResourceAppReuse.materialFacadeMismatch` | Render prepared material facade count differs from the app prepared material facade count. | —    | `packages/webgpu/src/resources/core/prepared-resource-app-reuse-alignment-summary.ts` |

## preparedResourceAppReuse.meshFacadeMismatch (1)

| Code                                          | Message                                                                            | Fix? | Emitted from                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| `preparedResourceAppReuse.meshFacadeMismatch` | Render prepared mesh facade count differs from the app prepared mesh facade count. | —    | `packages/webgpu/src/resources/core/prepared-resource-app-reuse-alignment-summary.ts` |

## preparedResourceLifetime.backendMissingResources (1)

| Code                                               | Message                                                                                    | Fix? | Emitted from                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------ |
| `preparedResourceLifetime.backendMissingResources` | Prepared facade entries exist while backend resource inspection reports missing resources. | —    | `packages/webgpu/src/resources/core/prepared-resource-lifetime-alignment-summary.ts` |

## preparedResourceLifetime.backendPendingDestroyResources (1)

| Code                                                      | Message                                                                                            | Fix? | Emitted from                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| `preparedResourceLifetime.backendPendingDestroyResources` | Prepared facade entries exist while backend resource inspection reports pending-destroy resources. | —    | `packages/webgpu/src/resources/core/prepared-resource-lifetime-alignment-summary.ts` |

## preparedResourceLifetime.backendStaleResources (1)

| Code                                             | Message                                                                                  | Fix? | Emitted from                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| `preparedResourceLifetime.backendStaleResources` | Prepared facade entries exist while backend resource inspection reports stale resources. | —    | `packages/webgpu/src/resources/core/prepared-resource-lifetime-alignment-summary.ts` |

## preparedScalarStandardMaterial.missingLayout (1)

| Code                                           | Message                                                                                 | Fix? | Emitted from                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `preparedScalarStandardMaterial.missingLayout` | Scalar StandardMaterial prepared caching requires a group-2 material bind group layout. | —    | `packages/webgpu/src/materials/standard/prepared-standard-material-scalar.ts` |

## preparedScalarStandardMaterial.missingPreparedBindGroup (1)

| Code                                                      | Message                                                                       | Fix? | Emitted from                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `preparedScalarStandardMaterial.missingPreparedBindGroup` | Scalar StandardMaterial prepared caching did not create a group-2 bind group. | —    | `packages/webgpu/src/materials/standard/prepared-standard-material-scalar.ts` |

## preparedScalarStandardMaterial.notScalar (1)

| Code                                       | Message                                                                                      | Fix? | Emitted from                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `preparedScalarStandardMaterial.notScalar` | Scalar StandardMaterial prepared caching does not handle textured StandardMaterial variants. | —    | `packages/webgpu/src/materials/standard/prepared-standard-material-scalar.ts` |

## preparedScalarUnlitMaterial.missingLayout (1)

| Code                                        | Message                                                                               | Fix? | Emitted from                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `preparedScalarUnlitMaterial.missingLayout` | Scalar unlit prepared material caching requires a group-2 material bind group layout. | —    | `packages/webgpu/src/materials/unlit/prepared-unlit-material-cache.ts` |

## preparedScalarUnlitMaterial.missingPreparedBindGroup (1)

| Code                                                   | Message                                                                     | Fix? | Emitted from                                                           |
| ------------------------------------------------------ | --------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `preparedScalarUnlitMaterial.missingPreparedBindGroup` | Scalar unlit prepared material caching did not create a group-2 bind group. | —    | `packages/webgpu/src/materials/unlit/prepared-unlit-material-cache.ts` |

## preparedScalarUnlitMaterial.notScalar (1)

| Code                                    | Message                                                                          | Fix? | Emitted from                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `preparedScalarUnlitMaterial.notScalar` | Scalar unlit prepared material caching does not handle textured unlit materials. | —    | `packages/webgpu/src/materials/unlit/prepared-unlit-material-cache.ts` |

## preparedStandardTextureDependency.missingSamplerHandle (1)

| Code                                                     | Message                                                               | Fix? | Emitted from                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------- |
| `preparedStandardTextureDependency.missingSamplerHandle` | Prepared StandardMaterial texture resources require a sampler handle. | —    | `packages/webgpu/src/materials/standard/prepared-standard-material-dependencies.ts` |

## preparedStandardTextureDependency.missingTextureHandle (1)

| Code                                                     | Message                                                               | Fix? | Emitted from                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------- |
| `preparedStandardTextureDependency.missingTextureHandle` | Prepared StandardMaterial texture resources require a texture handle. | —    | `packages/webgpu/src/materials/standard/prepared-standard-material-dependencies.ts` |

## preparedStandardTextureDependency.samplerSourceNotReady (1)

| Code                                                      | Message                                                                        | Fix? | Emitted from                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------- |
| `preparedStandardTextureDependency.samplerSourceNotReady` | Sampler source asset '…' is not ready for prepared StandardMaterial resources. | —    | `packages/webgpu/src/materials/standard/prepared-standard-material-dependencies.ts` |

## preparedStandardTextureDependency.textureSourceNotReady (1)

| Code                                                      | Message                                                                        | Fix? | Emitted from                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------- |
| `preparedStandardTextureDependency.textureSourceNotReady` | Texture source asset '…' is not ready for prepared StandardMaterial resources. | —    | `packages/webgpu/src/materials/standard/prepared-standard-material-dependencies.ts` |

## preparedTexturedUnlitMaterial.missingLayout (1)

| Code                                          | Message                                                                                 | Fix? | Emitted from                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `preparedTexturedUnlitMaterial.missingLayout` | Textured unlit prepared material caching requires a group-2 material bind group layout. | —    | `packages/webgpu/src/materials/unlit/prepared-unlit-material-cache.ts` |

## preparedTexturedUnlitMaterial.missingPreparedBindGroup (1)

| Code                                                     | Message                                                                       | Fix? | Emitted from                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `preparedTexturedUnlitMaterial.missingPreparedBindGroup` | Textured unlit prepared material caching did not create a group-2 bind group. | —    | `packages/webgpu/src/materials/unlit/prepared-unlit-material-cache.ts` |

## preparedTexturedUnlitMaterial.notTextured (1)

| Code                                        | Message                                                                         | Fix? | Emitted from                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `preparedTexturedUnlitMaterial.notTextured` | Textured unlit prepared material caching requires a base-color texture binding. | —    | `packages/webgpu/src/materials/unlit/prepared-unlit-material-cache.ts` |

## preparedUnlitTextureDependency.missingSamplerHandle (1)

| Code                                                  | Message                                                                         | Fix? | Emitted from                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `preparedUnlitTextureDependency.missingSamplerHandle` | Prepared textured unlit material resources require a base-color sampler handle. | —    | `packages/webgpu/src/materials/unlit/prepared-unlit-material-cache.ts` |

## preparedUnlitTextureDependency.missingTextureHandle (1)

| Code                                                  | Message                                                                         | Fix? | Emitted from                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `preparedUnlitTextureDependency.missingTextureHandle` | Prepared textured unlit material resources require a base-color texture handle. | —    | `packages/webgpu/src/materials/unlit/prepared-unlit-material-cache.ts` |

## preparedUnlitTextureDependency.samplerSourceNotReady (1)

| Code                                                   | Message                                                                      | Fix? | Emitted from                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `preparedUnlitTextureDependency.samplerSourceNotReady` | Sampler source asset '…' is not ready for prepared unlit material resources. | —    | `packages/webgpu/src/materials/unlit/prepared-unlit-material-cache.ts` |

## preparedUnlitTextureDependency.textureSourceNotReady (1)

| Code                                                   | Message                                                                      | Fix? | Emitted from                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `preparedUnlitTextureDependency.textureSourceNotReady` | Texture source asset '…' is not ready for prepared unlit material resources. | —    | `packages/webgpu/src/materials/unlit/prepared-unlit-material-cache.ts` |

## proceduralSky.invalidColor (1)

| Code                         | Message                                                       | Fix? | Emitted from                                                    |
| ---------------------------- | ------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `proceduralSky.invalidColor` | Procedural sky colors must be finite non-negative RGB values. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## proceduralSky.invalidDither (1)

| Code                          | Message                                                        | Fix? | Emitted from                                                    |
| ----------------------------- | -------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `proceduralSky.invalidDither` | Procedural sky ditherStrength must be finite and non-negative. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## proceduralSky.invalidHorizon (1)

| Code                           | Message                                                                                              | Fix? | Emitted from                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `proceduralSky.invalidHorizon` | Procedural sky horizonPosition must be in [0,1] and horizonSoftness must be finite and non-negative. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## proceduralSky.invalidIntensity (1)

| Code                             | Message                                                   | Fix? | Emitted from                                                    |
| -------------------------------- | --------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `proceduralSky.invalidIntensity` | Procedural sky intensity must be finite and non-negative. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## proceduralSky.invalidModel (1)

| Code                         | Message                                  | Fix? | Emitted from                                                    |
| ---------------------------- | ---------------------------------------- | ---- | --------------------------------------------------------------- |
| `proceduralSky.invalidModel` | Procedural sky model must be 'gradient'. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## proceduralSky.invalidPriority (1)

| Code                            | Message                                     | Fix? | Emitted from                                                    |
| ------------------------------- | ------------------------------------------- | ---- | --------------------------------------------------------------- |
| `proceduralSky.invalidPriority` | Procedural sky priority must be an integer. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## proceduralSky.invalidSun (1)

| Code                       | Message                                                               | Fix? | Emitted from                                                    |
| -------------------------- | --------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `proceduralSky.invalidSun` | Procedural sky sunRadius and sunGlow must be finite and non-negative. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## proceduralSky.invalidSunDirection (1)

| Code                                | Message                                                               | Fix? | Emitted from                                                    |
| ----------------------------------- | --------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `proceduralSky.invalidSunDirection` | Procedural sky sunDirection must be a finite non-zero vec3 direction. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## proceduralSkyFrame.createBindGroupUnavailable (1)

| Code                                            | Message                                                 | Fix? | Emitted from                                |
| ----------------------------------------------- | ------------------------------------------------------- | ---- | ------------------------------------------- |
| `proceduralSkyFrame.createBindGroupUnavailable` | WebGPU device cannot create procedural sky bind groups. | —    | `packages/webgpu/src/app/procedural-sky.ts` |

## proceduralSkyFrame.invalidPacket (1)

| Code                               | Message                                             | Fix? | Emitted from                                |
| ---------------------------------- | --------------------------------------------------- | ---- | ------------------------------------------- |
| `proceduralSkyFrame.invalidPacket` | Procedural sky … contains non-finite render values. | —    | `packages/webgpu/src/app/procedural-sky.ts` |

## proceduralSkyFrame.missingPipelineLayouts (1)

| Code                                        | Message                                                     | Fix? | Emitted from                                |
| ------------------------------------------- | ----------------------------------------------------------- | ---- | ------------------------------------------- |
| `proceduralSkyFrame.missingPipelineLayouts` | Procedural sky pipeline does not expose bind group layouts. | —    | `packages/webgpu/src/app/procedural-sky.ts` |

## proceduralSkyFrame.uniformWriteFailed (1)

| Code                                    | Message                                                         | Fix? | Emitted from                                |
| --------------------------------------- | --------------------------------------------------------------- | ---- | ------------------------------------------- |
| `proceduralSkyFrame.uniformWriteFailed` | WebGPU device cannot write updated procedural sky uniform data. | —    | `packages/webgpu/src/app/procedural-sky.ts` |

## proceduralSkyFrame.viewMatrixOutOfRange (1)

| Code                                      | Message                                                                          | Fix? | Emitted from                                |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ---- | ------------------------------------------- |
| `proceduralSkyFrame.viewMatrixOutOfRange` | Procedural sky view … view matrix offset … is outside snapshot view matrix data. | —    | `packages/webgpu/src/app/procedural-sky.ts` |

## proceduralSkyFrame.viewProjectionNotInvertible (1)

| Code                                             | Message                                                            | Fix? | Emitted from                                |
| ------------------------------------------------ | ------------------------------------------------------------------ | ---- | ------------------------------------------- |
| `proceduralSkyFrame.viewProjectionNotInvertible` | Procedural sky view … has a non-invertible view-projection matrix. | —    | `packages/webgpu/src/app/procedural-sky.ts` |

## proceduralSkyFrame.viewProjectionOutOfRange (1)

| Code                                          | Message                                                                                     | Fix? | Emitted from                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- | ---- | ------------------------------------------- |
| `proceduralSkyFrame.viewProjectionOutOfRange` | Procedural sky view … view-projection matrix offset … is outside snapshot view matrix data. | —    | `packages/webgpu/src/app/procedural-sky.ts` |

## proceduralSkyRenderPipeline.createRenderPipelineUnavailable (1)

| Code                                                          | Message                                                      | Fix? | Emitted from                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `proceduralSkyRenderPipeline.createRenderPipelineUnavailable` | WebGPU device cannot create procedural sky render pipelines. | —    | `packages/webgpu/src/render/skybox/procedural-sky-pipeline.ts` |

## proceduralSkyRenderPipeline.pipelineCreationFailed (1)

| Code                                                 | Message                       | Fix? | Emitted from                                                   |
| ---------------------------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------- |
| `proceduralSkyRenderPipeline.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/render/skybox/procedural-sky-pipeline.ts` |

## proceduralSkyRenderPipeline.shaderCreationFailed (1)

| Code                                               | Message                                                      | Fix? | Emitted from                                                   |
| -------------------------------------------------- | ------------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `proceduralSkyRenderPipeline.shaderCreationFailed` | WebGPU device cannot create procedural sky render pipelines. | —    | `packages/webgpu/src/render/skybox/procedural-sky-pipeline.ts` |

## proceduralSkyRenderPipeline.shaderDiagnostic (1)

| Code                                           | Message                       | Fix? | Emitted from                                                   |
| ---------------------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------- |
| `proceduralSkyRenderPipeline.shaderDiagnostic` | (message composed at runtime) | —    | `packages/webgpu/src/render/skybox/procedural-sky-pipeline.ts` |

## queuedBuiltInAppResourceAdapter.missingFamily (1)

| Code                                            | Message                       | Fix? | Emitted from                                                                   |
| ----------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------------------------------ |
| `queuedBuiltInAppResourceAdapter.missingFamily` | (message composed at runtime) | —    | `packages/webgpu/src/materials/core/built-in-material-app-resource-adapter.ts` |

## queuedMaterialAdapter.duplicateFamily (1)

| Code                                    | Message                                                                                              | Fix? | Emitted from                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `queuedMaterialAdapter.duplicateFamily` | Material adapter family '…' is registered more than once; the first adapter at index … will be used. | —    | `packages/webgpu/src/render/queues/queued-material-adapter.ts` |

## queuedMaterialAdapter.missingExpectedFamily (1)

| Code                                          | Message                       | Fix? | Emitted from                                                   |
| --------------------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------- |
| `queuedMaterialAdapter.missingExpectedFamily` | (message composed at runtime) | —    | `packages/webgpu/src/render/queues/queued-material-adapter.ts` |

## queuedMaterialPrepareRoute.materialMismatch (1)

| Code                                          | Message                       | Fix? | Emitted from                                                         |
| --------------------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------------- |
| `queuedMaterialPrepareRoute.materialMismatch` | (message composed at runtime) | —    | `packages/webgpu/src/render/queues/queued-material-prepare-route.ts` |

## queuedMaterialPrepareRoute.missingAdapter (1)

| Code                                        | Message                                                                         | Fix? | Emitted from                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `queuedMaterialPrepareRoute.missingAdapter` | No queued material prepare route adapter is registered for material family '…'. | —    | `packages/webgpu/src/render/queues/queued-material-prepare-route.ts` |

## queueSubmit.emptyCommandBuffers (1)

| Code                              | Message                                                | Fix? | Emitted from                                        |
| --------------------------------- | ------------------------------------------------------ | ---- | --------------------------------------------------- |
| `queueSubmit.emptyCommandBuffers` | Queue submission requires at least one command buffer. | —    | `packages/webgpu/src/render/queues/queue-submit.ts` |

## queueSubmit.missingSubmit (1)

| Code                        | Message                                     | Fix? | Emitted from                                        |
| --------------------------- | ------------------------------------------- | ---- | --------------------------------------------------- |
| `queueSubmit.missingSubmit` | WebGPU queue cannot submit command buffers. | —    | `packages/webgpu/src/render/queues/queue-submit.ts` |

## render.audio (1)

| Code                           | Message                                       | Fix? | Emitted from                                            |
| ------------------------------ | --------------------------------------------- | ---- | ------------------------------------------------------- |
| `render.audio.oneShotOverflow` | Dropped … one-shot(s): queue at capacity (…). | —    | `packages/render/src/rendering/audio-one-shot-queue.ts` |

## render.particle (5)

| Code                                  | Message                                                                                                                 | Fix? | Emitted from                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `render.particle.boundsLarge`         | Derived … particle bounds radius … is unusually large; set boundsRadius/boundsCenter explicitly if this is intentional. | —    | `packages/render/src/rendering/extraction-particles.ts` |
| `render.particle.boundsUnavailable`   | Could not derive conservative … particle bounds; using a 1 unit fallback radius.                                        | —    | `packages/render/src/rendering/extraction-particles.ts` |
| `render.particle.burstEffectInvalid`  | Dropped particle burst: effect '…' is invalid.                                                                          | —    | `packages/render/src/rendering/particle-burst-queue.ts` |
| `render.particle.burstEffectNotReady` | Dropped particle burst: effect '…' is not ready.                                                                        | —    | `packages/render/src/rendering/particle-burst-queue.ts` |
| `render.particle.burstOverflow`       | Dropped … particle burst(s): queue at capacity (…).                                                                     | —    | `packages/render/src/rendering/particle-burst-queue.ts` |

## render.standardMaterialTexture (1)

| Code                                              | Message                                                                                                      | Fix? | Emitted from                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------------- |
| `render.standardMaterialTexture.missingTexCoord1` | StandardMaterial … uses TEXCOORD_1 texture '…', but mesh '…' does not provide a TEXCOORD_1 vertex attribute. | —    | `packages/render/src/rendering/extraction-standard-material-validation.ts` |

## render.ui (2)

| Code                            | Message                                             | Fix? | Emitted from                                     |
| ------------------------------- | --------------------------------------------------- | ---- | ------------------------------------------------ |
| `render.ui.layoutDepthExceeded` | UI layout exceeded the maximum retained tree depth. | —    | `packages/render/src/rendering/extraction-ui.ts` |
| `render.ui.parentCycle`         | UI parent cycle detected; subtree skipped.          | —    | `packages/render/src/rendering/extraction-ui.ts` |

## renderAsset.customWgslMaterial (5)

| Code                                                | Message                                                               | Fix? | Emitted from                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `renderAsset.customWgslMaterial.invalidShaderAsset` | Custom WGSL material '…' shader asset '…' is not a WGSL shader asset. | —    | `packages/render/src/assets/custom-wgsl-material-preparation.ts` |
| `renderAsset.customWgslMaterial.shaderFailed`       | Custom WGSL material '…' shader asset '…' failed to load.             | —    | `packages/render/src/assets/custom-wgsl-material-preparation.ts` |
| `renderAsset.customWgslMaterial.shaderMissing`      | Custom WGSL material '…' references missing shader asset '…'.         | —    | `packages/render/src/assets/custom-wgsl-material-preparation.ts` |
| `renderAsset.customWgslMaterial.shaderNotReady`     | Custom WGSL material '…' shader asset '…' is '…'.                     | —    | `packages/render/src/assets/custom-wgsl-material-preparation.ts` |
| `renderAsset.customWgslMaterial.unloaded`           | Custom WGSL material '…' was unloaded.                                | —    | `packages/render/src/assets/custom-wgsl-material-preparation.ts` |

## renderAsset.sourceMissing (1)

| Code                        | Message                             | Fix? | Emitted from                                     |
| --------------------------- | ----------------------------------- | ---- | ------------------------------------------------ |
| `renderAsset.sourceMissing` | Source asset '…' is not registered. | —    | `packages/render/src/assets/preparation-core.ts` |

## renderBundle.finishFailed (1)

| Code                        | Message                       | Fix? | Emitted from                                       |
| --------------------------- | ----------------------------- | ---- | -------------------------------------------------- |
| `renderBundle.finishFailed` | (message composed at runtime) | —    | `packages/webgpu/src/render/draw/render-bundle.ts` |

## renderDrawPackage.blockedDraw (1)

| Code                            | Message                                             | Fix? | Emitted from                                                                                       |
| ------------------------------- | --------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `renderDrawPackage.blockedDraw` | Render object … is blocked by missing resources: …. | —    | `packages/render/src/rendering/draw-package.ts`<br>`packages/render/src/rendering/render-queue.ts` |

## renderDrawPackage.missingPackedTransform (1)

| Code                                       | Message                                                      | Fix? | Emitted from                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------ | ---- | -------------------------------------------------------------------------------------------------- |
| `renderDrawPackage.missingPackedTransform` | Render object … is ready but has no packed transform offset. | —    | `packages/render/src/rendering/draw-package.ts`<br>`packages/render/src/rendering/render-queue.ts` |

## rendererAssembly.frameNotReady (1)

| Code                             | Message                                    | Fix? | Emitted from                                                  |
| -------------------------------- | ------------------------------------------ | ---- | ------------------------------------------------------------- |
| `rendererAssembly.frameNotReady` | Frame report … is not ready for rendering. | —    | `packages/webgpu/src/render/frame/renderer-assembly-smoke.ts` |

## rendererAssembly.missingPackages (1)

| Code                               | Message                                                       | Fix? | Emitted from                                                  |
| ---------------------------------- | ------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `rendererAssembly.missingPackages` | Draw package inspection has no packages ready for submission. | —    | `packages/webgpu/src/render/frame/renderer-assembly-smoke.ts` |

## rendererAssembly.missingResources (1)

| Code                                | Message                                                  | Fix? | Emitted from                                                  |
| ----------------------------------- | -------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `rendererAssembly.missingResources` | Renderer resource summary is missing resource groups: …. | —    | `packages/webgpu/src/render/frame/renderer-assembly-smoke.ts` |

## rendererAssembly.missingSnapshotDraws (1)

| Code                                    | Message                                                 | Fix? | Emitted from                                                  |
| --------------------------------------- | ------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `rendererAssembly.missingSnapshotDraws` | Render snapshot inspection has no extracted mesh draws. | —    | `packages/webgpu/src/render/frame/renderer-assembly-smoke.ts` |

## rendererAssembly.missingSnapshotViews (1)

| Code                                    | Message                                            | Fix? | Emitted from                                                  |
| --------------------------------------- | -------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `rendererAssembly.missingSnapshotViews` | Render snapshot inspection has no extracted views. | —    | `packages/webgpu/src/render/frame/renderer-assembly-smoke.ts` |

## rendererAssembly.resourceErrors (1)

| Code                              | Message                                            | Fix? | Emitted from                                                  |
| --------------------------------- | -------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `rendererAssembly.resourceErrors` | Renderer resource summary has … error diagnostics. | —    | `packages/webgpu/src/render/frame/renderer-assembly-smoke.ts` |

## rendererAssembly.snapshotNotCloneable (1)

| Code                                    | Message                                         | Fix? | Emitted from                                                  |
| --------------------------------------- | ----------------------------------------------- | ---- | ------------------------------------------------------------- |
| `rendererAssembly.snapshotNotCloneable` | Render snapshot cloneability validation failed. | —    | `packages/webgpu/src/render/frame/renderer-assembly-smoke.ts` |

## renderFrameSnapshotBinding.duplicateRenderId (1)

| Code                                           | Message                                                          | Fix? | Emitted from                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `renderFrameSnapshotBinding.duplicateRenderId` | Duplicate render id … while planning snapshot resource bindings. | —    | `packages/webgpu/src/render/frame/renderer-frame-summary.ts` |

## renderFrameSnapshotBinding.missingMaterialResource (1)

| Code                                                 | Message                                                    | Fix? | Emitted from                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `renderFrameSnapshotBinding.missingMaterialResource` | No material resource binding was resolved for render id …. | —    | `packages/webgpu/src/render/frame/renderer-frame-summary.ts` |

## renderFrameSnapshotBinding.missingMeshResource (1)

| Code                                             | Message                                                | Fix? | Emitted from                                                 |
| ------------------------------------------------ | ------------------------------------------------------ | ---- | ------------------------------------------------------------ |
| `renderFrameSnapshotBinding.missingMeshResource` | No mesh resource binding was resolved for render id …. | —    | `packages/webgpu/src/render/frame/renderer-frame-summary.ts` |

## renderInstanceAttributePack.componentMismatch (1)

| Code                                            | Message                                                          | Fix? | Emitted from                                                |
| ----------------------------------------------- | ---------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `renderInstanceAttributePack.componentMismatch` | Render id … instance attribute '…' has … components; expected …. | —    | `packages/render/src/rendering/transform-pack-instances.ts` |

## renderInstanceAttributePack.missingAttribute (1)

| Code                                           | Message                                        | Fix? | Emitted from                                                |
| ---------------------------------------------- | ---------------------------------------------- | ---- | ----------------------------------------------------------- |
| `renderInstanceAttributePack.missingAttribute` | Render id … is missing instance attribute '…'. | —    | `packages/render/src/rendering/transform-pack-instances.ts` |

## renderInstanceAttributePack.missingPackedTransform (1)

| Code                                                 | Message                                                                                       | Fix? | Emitted from                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `renderInstanceAttributePack.missingPackedTransform` | Render id … references instance attributes, but no aligned packed transform offset was found. | —    | `packages/render/src/rendering/transform-pack-instances.ts` |

## renderInstanceAttributePack.missingPacket (1)

| Code                                        | Message                                                                       | Fix? | Emitted from                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `renderInstanceAttributePack.missingPacket` | Render id … references instance attribute packet …, but only … packets exist. | —    | `packages/render/src/rendering/transform-pack-instances.ts` |

## renderInstanceAttributePack.missingValues (1)

| Code                                        | Message                                                                                   | Fix? | Emitted from                                                |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `renderInstanceAttributePack.missingValues` | Render id … instance attribute '…' references offset …, but attribute buffer length is …. | —    | `packages/render/src/rendering/transform-pack-instances.ts` |

## renderInstanceTintPack.missingPackedTransform (1)

| Code                                            | Message                                                                                          | Fix? | Emitted from                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---- | ---------------------------------------------------------------- |
| `renderInstanceTintPack.missingPackedTransform` | Render id … references instance tint offset …, but no aligned packed transform offset was found. | —    | `packages/render/src/rendering/transform-pack-instance-tints.ts` |

## renderInstanceTintPack.missingTint (1)

| Code                                 | Message                                                                     | Fix? | Emitted from                                                     |
| ------------------------------------ | --------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `renderInstanceTintPack.missingTint` | Render id … references instance tint offset …, but tint buffer length is …. | —    | `packages/render/src/rendering/transform-pack-instance-tints.ts` |

## renderPackage.duplicateRenderId (1)

| Code                              | Message                                          | Fix? | Emitted from                                          |
| --------------------------------- | ------------------------------------------------ | ---- | ----------------------------------------------------- |
| `renderPackage.duplicateRenderId` | No render packages were provided for inspection. | —    | `packages/render/src/rendering/package-inspection.ts` |

## renderPackage.empty (1)

| Code                  | Message                                          | Fix? | Emitted from                                          |
| --------------------- | ------------------------------------------------ | ---- | ----------------------------------------------------- |
| `renderPackage.empty` | No render packages were provided for inspection. | —    | `packages/render/src/rendering/package-inspection.ts` |

## renderPassAttachment.invalidClearColor (1)

| Code                                     | Message                                                                     | Fix? | Emitted from                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `renderPassAttachment.invalidClearColor` | Render pass color target … clear color must be a finite [r, g, b, a] tuple. | —    | `packages/webgpu/src/render/passes/render-pass-attachments.ts` |

## renderPassAttachment.invalidDepthClear (1)

| Code                                     | Message                                                       | Fix? | Emitted from                                                   |
| ---------------------------------------- | ------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `renderPassAttachment.invalidDepthClear` | Depth clear value must be a finite number in [0, 1], not '…'. | —    | `packages/webgpu/src/render/passes/render-pass-attachments.ts` |

## renderPassAttachment.missingColorTarget (1)

| Code                                      | Message                                                             | Fix? | Emitted from                                                   |
| ----------------------------------------- | ------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `renderPassAttachment.missingColorTarget` | Render pass attachment planning requires at least one color target. | —    | `packages/webgpu/src/render/passes/render-pass-attachments.ts` |

## renderPassCommand.invalidTransformOffset (1)

| Code                                       | Message                                              | Fix? | Emitted from                                                |
| ------------------------------------------ | ---------------------------------------------------- | ---- | ----------------------------------------------------------- |
| `renderPassCommand.invalidTransformOffset` | Render id … has invalid transform packed offset '…'. | —    | `packages/webgpu/src/render/passes/render-pass-commands.ts` |

## renderPassCommandExecutor.missingMethod (1)

| Code                                      | Message                                             | Fix? | Emitted from                                                        |
| ----------------------------------------- | --------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `renderPassCommandExecutor.missingMethod` | Render pass encoder is missing '…' for render id …. | —    | `packages/webgpu/src/render/passes/render-pass-command-executor.ts` |

## renderPassDrawList.missingBindGroupResource (1)

| Code                                          | Message                       | Fix? | Emitted from                                                 |
| --------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------------ |
| `renderPassDrawList.missingBindGroupResource` | (message composed at runtime) | —    | `packages/webgpu/src/render/passes/render-pass-draw-list.ts` |

## renderPassDrawList.missingPipelineResource (1)

| Code                                         | Message                                               | Fix? | Emitted from                                                 |
| -------------------------------------------- | ----------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `renderPassDrawList.missingPipelineResource` | Missing render pipeline resource '…' for render id …. | —    | `packages/webgpu/src/render/passes/render-pass-draw-list.ts` |

## renderPassLifecycle.missingBeginRenderPass (1)

| Code                                         | Message                                     | Fix? | Emitted from                                                 |
| -------------------------------------------- | ------------------------------------------- | ---- | ------------------------------------------------------------ |
| `renderPassLifecycle.missingBeginRenderPass` | Command encoder cannot begin render passes. | —    | `packages/webgpu/src/render/passes/render-pass-lifecycle.ts` |

## renderPassLifecycle.missingEnd (1)

| Code                             | Message                                       | Fix? | Emitted from                                                 |
| -------------------------------- | --------------------------------------------- | ---- | ------------------------------------------------------------ |
| `renderPassLifecycle.missingEnd` | Render pass encoder cannot end render passes. | —    | `packages/webgpu/src/render/passes/render-pass-lifecycle.ts` |

## renderPassLifecycle.nullAttachmentPlan (1)

| Code                                     | Message                                                 | Fix? | Emitted from                                                 |
| ---------------------------------------- | ------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `renderPassLifecycle.nullAttachmentPlan` | Cannot begin a render pass from a null attachment plan. | —    | `packages/webgpu/src/render/passes/render-pass-lifecycle.ts` |

## renderPassResource.missingBindGroup (1)

| Code                                  | Message                                        | Fix? | Emitted from                                                 |
| ------------------------------------- | ---------------------------------------------- | ---- | ------------------------------------------------------------ |
| `renderPassResource.missingBindGroup` | Missing bind group handle '…' for render id …. | —    | `packages/webgpu/src/render/passes/render-pass-resources.ts` |

## renderPassResource.missingIndexBuffer (1)

| Code                                    | Message                                          | Fix? | Emitted from                                                 |
| --------------------------------------- | ------------------------------------------------ | ---- | ------------------------------------------------------------ |
| `renderPassResource.missingIndexBuffer` | Missing index buffer handle '…' for render id …. | —    | `packages/webgpu/src/render/passes/render-pass-resources.ts` |

## renderPassResource.missingPipeline (1)

| Code                                 | Message                                             | Fix? | Emitted from                                                 |
| ------------------------------------ | --------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `renderPassResource.missingPipeline` | Missing render pipeline handle '…' for render id …. | —    | `packages/webgpu/src/render/passes/render-pass-resources.ts` |

## renderPassResource.missingVertexBuffer (1)

| Code                                     | Message                                           | Fix? | Emitted from                                                 |
| ---------------------------------------- | ------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `renderPassResource.missingVertexBuffer` | Missing vertex buffer handle '…' for render id …. | —    | `packages/webgpu/src/render/passes/render-pass-resources.ts` |

## renderPreviousTransformPack.missingCurrentTransform (1)

| Code                                                  | Message                                                                                          | Fix? | Emitted from                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------- |
| `renderPreviousTransformPack.missingCurrentTransform` | Render id … references packed transform offset …, but current packed transform data length is …. | —    | `packages/render/src/rendering/transform-pack-history.ts` |

## renderResourceInspection.missingResource (1)

| Code                                       | Message                           | Fix? | Emitted from                                               |
| ------------------------------------------ | --------------------------------- | ---- | ---------------------------------------------------------- |
| `renderResourceInspection.missingResource` | Renderer resource '…' is missing. | —    | `packages/webgpu/src/resources/core/resource-lifecycle.ts` |

## renderResourceInspection.pendingDestroy (1)

| Code                                      | Message                                       | Fix? | Emitted from                                               |
| ----------------------------------------- | --------------------------------------------- | ---- | ---------------------------------------------------------- |
| `renderResourceInspection.pendingDestroy` | Renderer resource '…' is pending destruction. | —    | `packages/webgpu/src/resources/core/resource-lifecycle.ts` |

## renderResourceInspection.staleResource (1)

| Code                                     | Message                         | Fix? | Emitted from                                               |
| ---------------------------------------- | ------------------------------- | ---- | ---------------------------------------------------------- |
| `renderResourceInspection.staleResource` | Renderer resource '…' is stale. | —    | `packages/webgpu/src/resources/core/resource-lifecycle.ts` |

## renderSnapshot.empty (1)

| Code                   | Message                              | Fix? | Emitted from                                           |
| ---------------------- | ------------------------------------ | ---- | ------------------------------------------------------ |
| `renderSnapshot.empty` | Render snapshot contains no packets. | —    | `packages/render/src/rendering/snapshot-inspection.ts` |

## renderSnapshotClone.cloneFailed (1)

| Code                              | Message                       | Fix? | Emitted from                                      |
| --------------------------------- | ----------------------------- | ---- | ------------------------------------------------- |
| `renderSnapshotClone.cloneFailed` | (message composed at runtime) | —    | `packages/render/src/rendering/snapshot-clone.ts` |

## renderSnapshotClone.invalidTransformBuffer (1)

| Code                                         | Message                                           | Fix? | Emitted from                                      |
| -------------------------------------------- | ------------------------------------------------- | ---- | ------------------------------------------------- |
| `renderSnapshotClone.invalidTransformBuffer` | RenderSnapshot.transforms must be a Float32Array. | —    | `packages/render/src/rendering/snapshot-clone.ts` |

## renderSnapshotClone.invalidViewMatrixBuffer (1)

| Code                                          | Message                                             | Fix? | Emitted from                                      |
| --------------------------------------------- | --------------------------------------------------- | ---- | ------------------------------------------------- |
| `renderSnapshotClone.invalidViewMatrixBuffer` | RenderSnapshot.viewMatrices must be a Float32Array. | —    | `packages/render/src/rendering/snapshot-clone.ts` |

## renderTransformPack.missingTransform (1)

| Code                                   | Message                                                                      | Fix? | Emitted from                                             |
| -------------------------------------- | ---------------------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `renderTransformPack.missingTransform` | Render id … references transform offset …, but transform buffer length is …. | —    | `packages/render/src/rendering/transform-pack-guards.ts` |

## renderWorld.duplicateRenderId (1)

| Code                            | Message                            | Fix? | Emitted from                                          |
| ------------------------------- | ---------------------------------- | ---- | ----------------------------------------------------- |
| `renderWorld.duplicateRenderId` | Duplicate render id … in snapshot. | —    | `packages/render/src/rendering/render-world-apply.ts` |

## renderWorld.empty (1)

| Code                | Message                                  | Fix? | Emitted from                                              |
| ------------------- | ---------------------------------------- | ---- | --------------------------------------------------------- |
| `renderWorld.empty` | Render world has no active draw objects. | —    | `packages/render/src/rendering/render-world-readiness.ts` |

## renderWorld.missingMaterialResource (1)

| Code                                  | Message                                                 | Fix? | Emitted from                                              |
| ------------------------------------- | ------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `renderWorld.missingMaterialResource` | Render object … is missing a material resource binding. | —    | `packages/render/src/rendering/render-world-readiness.ts` |

## renderWorld.missingMeshResource (1)

| Code                              | Message                                             | Fix? | Emitted from                                              |
| --------------------------------- | --------------------------------------------------- | ---- | --------------------------------------------------------- |
| `renderWorld.missingMeshResource` | Render object … is missing a mesh resource binding. | —    | `packages/render/src/rendering/render-world-readiness.ts` |

## renderWorld.missingPreparedMaterialResource (1)

| Code                                          | Message                                                    | Fix? | Emitted from                                                       |
| --------------------------------------------- | ---------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `renderWorld.missingPreparedMaterialResource` | Render object … has no prepared material resource for '…'. | —    | `packages/render/src/rendering/render-world-prepared-materials.ts` |

## renderWorld.missingPreparedMeshResource (1)

| Code                                      | Message                                                | Fix? | Emitted from                                                    |
| ----------------------------------------- | ------------------------------------------------------ | ---- | --------------------------------------------------------------- |
| `renderWorld.missingPreparedMeshResource` | Render object … has no prepared mesh resource for '…'. | —    | `packages/render/src/rendering/render-world-prepared-meshes.ts` |

## renderWorld.missingRenderId (1)

| Code                          | Message                                                  | Fix? | Emitted from                                    |
| ----------------------------- | -------------------------------------------------------- | ---- | ----------------------------------------------- |
| `renderWorld.missingRenderId` | Cannot update resource bindings for missing render id …. | —    | `packages/render/src/rendering/render-world.ts` |

## runtimeUniform.invalidKey (1)

| Code                        | Message                                         | Fix? | Emitted from                                                    |
| --------------------------- | ----------------------------------------------- | ---- | --------------------------------------------------------------- |
| `runtimeUniform.invalidKey` | Runtime uniform key must be a non-empty string. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## runtimeUniform.invalidValues (1)

| Code                           | Message                                                                                                              | Fix? | Emitted from                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `runtimeUniform.invalidValues` | Runtime uniform values must be a plain object of finite numbers, booleans, nulls, strings, or finite numeric arrays. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## runtimeUniform.invalidVersion (1)

| Code                            | Message                                                      | Fix? | Emitted from                                                    |
| ------------------------------- | ------------------------------------------------------------ | ---- | --------------------------------------------------------------- |
| `runtimeUniform.invalidVersion` | Runtime uniform version must be a non-negative safe integer. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## shaderMetadata.missingBinding (1)

| Code                            | Message                                                   | Fix? | Emitted from                                                                                                                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shaderMetadata.missingBinding` | Built-in shader metadata is missing '…' binding metadata. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-shader.ts`<br>`packages/webgpu/src/materials/matcap/matcap-shader.ts`<br>`packages/webgpu/src/materials/standard/standard-shader.ts`<br>`packages/webgpu/src/materials/unlit/unlit-shader.ts` |

## shaderMetadata.missingCode (1)

| Code                         | Message                                             | Fix? | Emitted from                                                                                                                                                                                                                                           |
| ---------------------------- | --------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shaderMetadata.missingCode` | Built-in shader metadata requires WGSL source code. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-shader.ts`<br>`packages/webgpu/src/materials/matcap/matcap-shader.ts`<br>`packages/webgpu/src/materials/standard/standard-shader.ts`<br>`packages/webgpu/src/materials/unlit/unlit-shader.ts` |

## shaderMetadata.missingEntryPoint (1)

| Code                               | Message                                                 | Fix? | Emitted from                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shaderMetadata.missingEntryPoint` | Built-in shader metadata requires a vertex entry point. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-shader.ts`<br>`packages/webgpu/src/materials/matcap/matcap-shader.ts`<br>`packages/webgpu/src/materials/standard/standard-shader.ts`<br>`packages/webgpu/src/materials/unlit/unlit-shader.ts` |

## shaderMetadata.missingLabel (1)

| Code                          | Message                                              | Fix? | Emitted from                                                                                                                                                                                                                                           |
| ----------------------------- | ---------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shaderMetadata.missingLabel` | Built-in shader metadata requires a non-empty label. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-shader.ts`<br>`packages/webgpu/src/materials/matcap/matcap-shader.ts`<br>`packages/webgpu/src/materials/standard/standard-shader.ts`<br>`packages/webgpu/src/materials/unlit/unlit-shader.ts` |

## shaderResource.compilationDiagnostic (1)

| Code                                   | Message                       | Fix? | Emitted from                                 |
| -------------------------------------- | ----------------------------- | ---- | -------------------------------------------- |
| `shaderResource.compilationDiagnostic` | (message composed at runtime) | —    | `packages/webgpu/src/gpu/shader-resource.ts` |

## shaderResource.creationFailed (1)

| Code                            | Message                       | Fix? | Emitted from                                 |
| ------------------------------- | ----------------------------- | ---- | -------------------------------------------- |
| `shaderResource.creationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/gpu/shader-resource.ts` |

## shaderResource.nullDescriptor (1)

| Code                            | Message                                                      | Fix? | Emitted from                                 |
| ------------------------------- | ------------------------------------------------------------ | ---- | -------------------------------------------- |
| `shaderResource.nullDescriptor` | Cannot create shader module resource from a null descriptor. | —    | `packages/webgpu/src/gpu/shader-resource.ts` |

## shadow.invalidBias (1)

| Code                 | Message                                                | Fix? | Emitted from                                                   |
| -------------------- | ------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `shadow.invalidBias` | Light shadow bias and normalBias must be non-negative. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## shadow.invalidCascadeCount (1)

| Code                         | Message                                                         | Fix? | Emitted from                                                   |
| ---------------------------- | --------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadow.invalidCascadeCount` | Directional shadow cascadeCount must be an integer from 1 to 4. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## shadow.invalidFilterRadius (1)

| Code                         | Message                                         | Fix? | Emitted from                                                   |
| ---------------------------- | ----------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadow.invalidFilterRadius` | Light shadow filterRadius must be non-negative. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## shadow.invalidFixedCamera (1)

| Code                        | Message                                                                       | Fix? | Emitted from                                                   |
| --------------------------- | ----------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadow.invalidFixedCamera` | Light shadow near, far, and lightDistance must be non-negative when authored. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## shadow.invalidMapSize (1)

| Code                    | Message                                          | Fix? | Emitted from                                                   |
| ----------------------- | ------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `shadow.invalidMapSize` | Light shadow mapSize must be a positive integer. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## shadow.invalidOrthographicSize (1)

| Code                             | Message                                             | Fix? | Emitted from                                                   |
| -------------------------------- | --------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadow.invalidOrthographicSize` | Light shadow orthographicSize must be non-negative. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## shadow.invalidShadowType (1)

| Code                       | Message                                                         | Fix? | Emitted from                                                   |
| -------------------------- | --------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadow.invalidShadowType` | Light shadow shadowType must be 0 (hard), 1 (PCF), or 2 (PCSS). | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## shadow.invalidSlopeBias (1)

| Code                      | Message                                      | Fix? | Emitted from                                                   |
| ------------------------- | -------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadow.invalidSlopeBias` | Light shadow slopeBias must be non-negative. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## shadow.invalidStrength (1)

| Code                     | Message                                            | Fix? | Emitted from                                                   |
| ------------------------ | -------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadow.invalidStrength` | Light shadow strength must be in the range [0, 1]. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## shadow.zeroLayerMask (1)

| Code                   | Message                                                        | Fix? | Emitted from                                                   |
| ---------------------- | -------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadow.zeroLayerMask` | Light shadow caster and receiver layer masks must not be zero. | —    | `packages/render/src/rendering/authoring-validation-lights.ts` |

## shadowCasterCommandPlan.commandEncodingDeferred (1)

| Code                                              | Message                                                                              | Fix? | Emitted from                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------- |
| `shadowCasterCommandPlan.commandEncodingDeferred` | Shadow caster command plans are ready as data, but GPU command encoding is deferred. | —    | `packages/webgpu/src/shadows/shadow-caster-command-plan-readiness.ts` |

## shadowCasterCommandPlan.missingCasterDrawList (1)

| Code                                            | Message                                                                | Fix? | Emitted from                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `shadowCasterCommandPlan.missingCasterDrawList` | Shadow caster command planning requires shadow caster draw-list plans. | —    | `packages/webgpu/src/shadows/shadow-caster-command-plan-readiness.ts` |

## shadowCasterCommandPlan.missingMatrixBuffer (1)

| Code                                          | Message                                                                    | Fix? | Emitted from                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `shadowCasterCommandPlan.missingMatrixBuffer` | Shadow caster command planning requires a shadow matrix-buffer descriptor. | —    | `packages/webgpu/src/shadows/shadow-caster-command-plan-readiness.ts` |

## shadowCasterCommandPlan.missingMatrixEntry (1)

| Code                                         | Message                                                                        | Fix? | Emitted from                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------- |
| `shadowCasterCommandPlan.missingMatrixEntry` | Shadow caster command plan for shadow '…' has no matching matrix-buffer entry. | —    | `packages/webgpu/src/shadows/shadow-caster-command-plan-readiness.ts` |

## shadowCasterCommandPlan.missingPassPlan (1)

| Code                                      | Message                                                           | Fix? | Emitted from                                                          |
| ----------------------------------------- | ----------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `shadowCasterCommandPlan.missingPassPlan` | Shadow caster command planning requires a valid shadow pass plan. | —    | `packages/webgpu/src/shadows/shadow-caster-command-plan-readiness.ts` |

## shadowCasterCommandPlan.missingViewProjection (1)

| Code                                            | Message                                                               | Fix? | Emitted from                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `shadowCasterCommandPlan.missingViewProjection` | Shadow caster command planning requires shadow view/projection plans. | —    | `packages/webgpu/src/shadows/shadow-caster-command-plan-readiness.ts` |

## shadowCasterCommandPlan.unsupportedMatrixBuffer (1)

| Code                                              | Message                                                                         | Fix? | Emitted from                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `shadowCasterCommandPlan.unsupportedMatrixBuffer` | Shadow caster command planning cannot use the current matrix-buffer descriptor. | —    | `packages/webgpu/src/shadows/shadow-caster-command-plan-readiness.ts` |

## shadowCasterCommandPlan.unsupportedViewProjection (1)

| Code                                                | Message                                                                             | Fix? | Emitted from                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `shadowCasterCommandPlan.unsupportedViewProjection` | Shadow caster command planning cannot use the current shadow view/projection plans. | —    | `packages/webgpu/src/shadows/shadow-caster-command-plan-readiness.ts` |

## shadowCasterCommandRecord.commandPlanningFailed (1)

| Code                                              | Message                       | Fix? | Emitted from                                                       |
| ------------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterCommandRecord.commandPlanningFailed` | (message composed at runtime) | —    | `packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts` |

## shadowCasterCommandRecord.frameResourcesNotReady (1)

| Code                                               | Message                                                                                | Fix? | Emitted from                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterCommandRecord.frameResourcesNotReady` | Shadow caster command records require at least one ready caster frame-resource record. | —    | `packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts` |

## shadowCasterCommandRecord.invalidMatrixOffset (1)

| Code                                            | Message                                               | Fix? | Emitted from                                                       |
| ----------------------------------------------- | ----------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterCommandRecord.invalidMatrixOffset` | Shadow caster '…' has invalid matrix byte offset '…'. | —    | `packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts` |

## shadowCasterCommandRecord.missingCommandPlan (1)

| Code                                           | Message                                             | Fix? | Emitted from                                                       |
| ---------------------------------------------- | --------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterCommandRecord.missingCommandPlan` | Shadow caster '…' has no command plan for pass '…'. | —    | `packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts` |

## shadowCasterCommandRecord.missingIndexBufferResource (1)

| Code                                                   | Message                                                                            | Fix? | Emitted from                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterCommandRecord.missingIndexBufferResource` | Shadow caster '…' requires an index buffer resource for depth-only shadow drawing. | —    | `packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts` |

## shadowCasterCommandRecord.missingMatrixBindGroupResource (1)

| Code                                                       | Message                                                              | Fix? | Emitted from                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterCommandRecord.missingMatrixBindGroupResource` | Shadow caster '…' requires a live shadow matrix bind group resource. | —    | `packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts` |

## shadowCasterCommandRecord.missingMeshResource (1)

| Code                                            | Message                                                   | Fix? | Emitted from                                                       |
| ----------------------------------------------- | --------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterCommandRecord.missingMeshResource` | Shadow caster '…' requires a live prepared mesh resource. | —    | `packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts` |

## shadowCasterCommandRecord.missingPipelineResource (1)

| Code                                                | Message                                                         | Fix? | Emitted from                                                       |
| --------------------------------------------------- | --------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterCommandRecord.missingPipelineResource` | Shadow caster '…' requires a live depth-only pipeline resource. | —    | `packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts` |

## shadowCasterCommandRecord.missingVertexBufferResource (1)

| Code                                                    | Message                                                         | Fix? | Emitted from                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterCommandRecord.missingVertexBufferResource` | Shadow caster '…' requires at least one vertex buffer resource. | —    | `packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts` |

## shadowCasterCommandRecord.passSubmissionDeferred (1)

| Code                                               | Message                                                                                                    | Fix? | Emitted from                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterCommandRecord.passSubmissionDeferred` | Shadow caster command records are executable, but command-buffer finish and queue submission are deferred. | —    | `packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts` |

## shadowCasterCommandRecord.shaderSamplingDeferred (1)

| Code                                               | Message                                                                                              | Fix? | Emitted from                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterCommandRecord.shaderSamplingDeferred` | Shadow caster command records are executable, but StandardMaterial shadow sampling remains deferred. | —    | `packages/webgpu/src/shadows/shadow-caster-command-record-plan.ts` |

## shadowCasterDrawList.commandEncodingDeferred (1)

| Code                                           | Message                                                                                   | Fix? | Emitted from                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `shadowCasterDrawList.commandEncodingDeferred` | Shadow caster draw lists are planned, but shadow command encoding is not implemented yet. | —    | `packages/webgpu/src/shadows/shadow-caster-draw-list-plan.ts` |

## shadowCasterDrawList.missingPassPlan (1)

| Code                                   | Message                                                                      | Fix? | Emitted from                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `shadowCasterDrawList.missingPassPlan` | Shadow request '…' has no planned shadow pass for caster draw-list planning. | —    | `packages/webgpu/src/shadows/shadow-caster-draw-list-plan.ts` |

## shadowCasterDrawList.noCasters (1)

| Code                             | Message                                                                                   | Fix? | Emitted from                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `shadowCasterDrawList.noCasters` | Shadow caster draw lists are planned, but shadow command encoding is not implemented yet. | —    | `packages/webgpu/src/shadows/shadow-caster-draw-list-plan.ts` |

## shadowCasterFrameResource.missingMatrixBuffer (1)

| Code                                            | Message                                                                     | Fix? | Emitted from                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `shadowCasterFrameResource.missingMatrixBuffer` | Shadow caster frame resources require a live shadow matrix buffer resource. | —    | `packages/webgpu/src/shadows/shadow-caster-frame-resource-readiness.ts` |

## shadowCasterFrameResource.missingPipelineDescriptor (1)

| Code                                                  | Message                                                                               | Fix? | Emitted from                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `shadowCasterFrameResource.missingPipelineDescriptor` | Shadow caster frame resources require a depth-only shadow caster pipeline descriptor. | —    | `packages/webgpu/src/shadows/shadow-caster-frame-resource-readiness.ts` |

## shadowCasterFrameResource.missingPreparedMesh (1)

| Code                                            | Message                                                              | Fix? | Emitted from                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `shadowCasterFrameResource.missingPreparedMesh` | Shadow caster draw '…' has no prepared mesh buffer resource for '…'. | —    | `packages/webgpu/src/shadows/shadow-caster-frame-resource-readiness.ts` |

## shadowCasterFrameResource.passSubmissionDeferred (1)

| Code                                               | Message                                                                            | Fix? | Emitted from                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `shadowCasterFrameResource.passSubmissionDeferred` | Shadow caster frame resources are planned, but shadow pass submission is deferred. | —    | `packages/webgpu/src/shadows/shadow-caster-frame-resource-readiness.ts` |

## shadowCasterFrameResource.pipelineCreationDeferred (1)

| Code                                                 | Message                                                                                                  | Fix? | Emitted from                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `shadowCasterFrameResource.pipelineCreationDeferred` | Shadow caster frame resources have pipeline descriptor metadata, but live pipeline creation is deferred. | —    | `packages/webgpu/src/shadows/shadow-caster-frame-resource-readiness.ts` |

## shadowCasterMatrixBindGroupResource.createBindGroupLayoutUnavailable (1)

| Code                                                                   | Message                                                                 | Fix? | Emitted from                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `shadowCasterMatrixBindGroupResource.createBindGroupLayoutUnavailable` | WebGPU device cannot create the shadow caster matrix bind-group layout. | —    | `packages/webgpu/src/shadows/shadow-caster-matrix-bind-group-resource.ts` |

## shadowCasterMatrixBindGroupResource.createBindGroupUnavailable (1)

| Code                                                             | Message                                                          | Fix? | Emitted from                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `shadowCasterMatrixBindGroupResource.createBindGroupUnavailable` | WebGPU device cannot create the shadow caster matrix bind group. | —    | `packages/webgpu/src/shadows/shadow-caster-matrix-bind-group-resource.ts` |

## shadowCasterMatrixBindGroupResource.creationFailed (1)

| Code                                                 | Message                       | Fix? | Emitted from                                                              |
| ---------------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------------------------- |
| `shadowCasterMatrixBindGroupResource.creationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/shadows/shadow-caster-matrix-bind-group-resource.ts` |

## shadowCasterMatrixBindGroupResource.missingMatrixBufferResource (1)

| Code                                                              | Message                                                                                 | Fix? | Emitted from                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `shadowCasterMatrixBindGroupResource.missingMatrixBufferResource` | Shadow caster matrix bind-group creation requires a live shadow matrix buffer resource. | —    | `packages/webgpu/src/shadows/shadow-caster-matrix-bind-group-resource.ts` |

## shadowCasterMatrixBindGroupResource.missingPassMatrixResource (1)

| Code                                                            | Message                                                                            | Fix? | Emitted from                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `shadowCasterMatrixBindGroupResource.missingPassMatrixResource` | Shadow caster matrix bind-group creation requires at least one pass matrix buffer. | —    | `packages/webgpu/src/shadows/shadow-caster-matrix-bind-group-resource.ts` |

## shadowCasterMatrixBindGroupResource.missingWorldTransformResource (1)

| Code                                                                | Message                                                                     | Fix? | Emitted from                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `shadowCasterMatrixBindGroupResource.missingWorldTransformResource` | Shadow caster matrix bind-group creation requires a world-transform buffer. | —    | `packages/webgpu/src/shadows/shadow-caster-matrix-bind-group-resource.ts` |

## shadowCasterMatrixBindGroupResource.passSubmissionDeferred (1)

| Code                                                         | Message                                                                               | Fix? | Emitted from                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `shadowCasterMatrixBindGroupResource.passSubmissionDeferred` | Shadow caster matrix bind group is available, but shadow pass submission is deferred. | —    | `packages/webgpu/src/shadows/shadow-caster-matrix-bind-group-resource.ts` |

## shadowCasterMatrixBindGroupResource.shaderSamplingDeferred (1)

| Code                                                         | Message                                                                                              | Fix? | Emitted from                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `shadowCasterMatrixBindGroupResource.shaderSamplingDeferred` | Shadow caster matrix bind group is available, but StandardMaterial shadow sampling remains deferred. | —    | `packages/webgpu/src/shadows/shadow-caster-matrix-bind-group-resource.ts` |

## shadowCasterPipelineDescriptor.commandEncodingDeferred (1)

| Code                                                     | Message                                                                                                             | Fix? | Emitted from                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterPipelineDescriptor.commandEncodingDeferred` | Shadow caster pipeline descriptor metadata is planned, but shadow pass command encoding is still deferred upstream. | —    | `packages/webgpu/src/shadows/shadow-caster-pipeline-descriptor.ts` |

## shadowCasterPipelineDescriptor.missingCommandEncoding (1)

| Code                                                    | Message                                                                          | Fix? | Emitted from                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterPipelineDescriptor.missingCommandEncoding` | Shadow caster pipeline descriptor metadata requires shadow pass command records. | —    | `packages/webgpu/src/shadows/shadow-caster-pipeline-descriptor.ts` |

## shadowCasterPipelineDescriptor.missingDepthFormat (1)

| Code                                                | Message                                                             | Fix? | Emitted from                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterPipelineDescriptor.missingDepthFormat` | Shadow caster pipeline descriptor metadata requires a depth format. | —    | `packages/webgpu/src/shadows/shadow-caster-pipeline-descriptor.ts` |

## shadowCasterPipelineDescriptor.passSubmissionDeferred (1)

| Code                                                    | Message                                                                                        | Fix? | Emitted from                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterPipelineDescriptor.passSubmissionDeferred` | Shadow caster pipeline descriptor metadata is planned, but shadow pass submission is deferred. | —    | `packages/webgpu/src/shadows/shadow-caster-pipeline-descriptor.ts` |

## shadowCasterPipelineDescriptor.unsupportedTopology (1)

| Code                                                 | Message                                                                                                             | Fix? | Emitted from                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowCasterPipelineDescriptor.unsupportedTopology` | Shadow caster pipeline descriptor metadata is planned, but shadow pass command encoding is still deferred upstream. | —    | `packages/webgpu/src/shadows/shadow-caster-pipeline-descriptor.ts` |

## shadowCasterPipelineResource.createRenderPipelineUnavailable (1)

| Code                                                           | Message                                                        | Fix? | Emitted from                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCasterPipelineResource.createRenderPipelineUnavailable` | WebGPU device cannot create the shadow caster render pipeline. | —    | `packages/webgpu/src/shadows/shadow-caster-pipeline-resource.ts` |

## shadowCasterPipelineResource.createShaderModuleUnavailable (1)

| Code                                                         | Message                                                      | Fix? | Emitted from                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ---- | ---------------------------------------------------------------- |
| `shadowCasterPipelineResource.createShaderModuleUnavailable` | WebGPU device cannot create the shadow caster shader module. | —    | `packages/webgpu/src/shadows/shadow-caster-pipeline-resource.ts` |

## shadowCasterPipelineResource.missingDescriptor (1)

| Code                                             | Message                                                                                    | Fix? | Emitted from                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---- | ---------------------------------------------------------------- |
| `shadowCasterPipelineResource.missingDescriptor` | Shadow caster pipeline resource creation requires depth-only pipeline descriptor metadata. | —    | `packages/webgpu/src/shadows/shadow-caster-pipeline-resource.ts` |

## shadowCasterPipelineResource.passSubmissionDeferred (1)

| Code                                                  | Message                                                                               | Fix? | Emitted from                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCasterPipelineResource.passSubmissionDeferred` | Shadow caster pipeline resource is available, but shadow pass submission is deferred. | —    | `packages/webgpu/src/shadows/shadow-caster-pipeline-resource.ts` |

## shadowCasterPipelineResource.pipelineCreationFailed (1)

| Code                                                  | Message                       | Fix? | Emitted from                                                     |
| ----------------------------------------------------- | ----------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCasterPipelineResource.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/shadows/shadow-caster-pipeline-resource.ts` |

## shadowCasterPipelineResource.shaderSamplingDeferred (1)

| Code                                                  | Message                                                                                              | Fix? | Emitted from                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCasterPipelineResource.shaderSamplingDeferred` | Shadow caster pipeline resource is available, but StandardMaterial shadow sampling remains deferred. | —    | `packages/webgpu/src/shadows/shadow-caster-pipeline-resource.ts` |

## shadowCommandResourceSummary.commandEncodingDeferred (1)

| Code                                                   | Message                                                                           | Fix? | Emitted from                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCommandResourceSummary.commandEncodingDeferred` | Shadow command plans are available as data, but GPU command encoding is deferred. | —    | `packages/webgpu/src/shadows/shadow-command-resource-summary.ts` |

## shadowCommandResourceSummary.missingCasterDrawList (1)

| Code                                                 | Message                                                            | Fix? | Emitted from                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------ | ---- | ---------------------------------------------------------------- |
| `shadowCommandResourceSummary.missingCasterDrawList` | Shadow command resource summary requires shadow caster draw lists. | —    | `packages/webgpu/src/shadows/shadow-command-resource-summary.ts` |

## shadowCommandResourceSummary.missingCommandPlan (1)

| Code                                              | Message                                                 | Fix? | Emitted from                                                     |
| ------------------------------------------------- | ------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCommandResourceSummary.missingCommandPlan` | Shadow command resource summary requires command plans. | —    | `packages/webgpu/src/shadows/shadow-command-resource-summary.ts` |

## shadowCommandResourceSummary.missingMatrixBuffer (1)

| Code                                               | Message                                                                     | Fix? | Emitted from                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCommandResourceSummary.missingMatrixBuffer` | Shadow command resource summary requires a shadow matrix-buffer descriptor. | —    | `packages/webgpu/src/shadows/shadow-command-resource-summary.ts` |

## shadowCommandResourceSummary.missingPassPlan (1)

| Code                                           | Message                                                     | Fix? | Emitted from                                                     |
| ---------------------------------------------- | ----------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCommandResourceSummary.missingPassPlan` | Shadow command resource summary requires shadow pass plans. | —    | `packages/webgpu/src/shadows/shadow-command-resource-summary.ts` |

## shadowCommandResourceSummary.missingTextureResources (1)

| Code                                                   | Message                                                                             | Fix? | Emitted from                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCommandResourceSummary.missingTextureResources` | Shadow command resource summary requires valid shadow texture resource descriptors. | —    | `packages/webgpu/src/shadows/shadow-command-resource-summary.ts` |

## shadowCommandResourceSummary.missingViewProjection (1)

| Code                                                 | Message                                                                            | Fix? | Emitted from                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCommandResourceSummary.missingViewProjection` | Shadow command resource summary requires directional shadow view/projection plans. | —    | `packages/webgpu/src/shadows/shadow-command-resource-summary.ts` |

## shadowCommandResourceSummary.textureAllocationDeferred (1)

| Code                                                     | Message                                                                       | Fix? | Emitted from                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCommandResourceSummary.textureAllocationDeferred` | Shadow texture resources are planned, but GPU texture allocation is deferred. | —    | `packages/webgpu/src/shadows/shadow-command-resource-summary.ts` |

## shadowCommandResourceSummary.unsupportedMatrixBuffer (1)

| Code                                                   | Message                                                                          | Fix? | Emitted from                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCommandResourceSummary.unsupportedMatrixBuffer` | Shadow command resource summary cannot use the current matrix-buffer descriptor. | —    | `packages/webgpu/src/shadows/shadow-command-resource-summary.ts` |

## shadowCommandResourceSummary.unsupportedViewProjection (1)

| Code                                                     | Message                                                                                           | Fix? | Emitted from                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowCommandResourceSummary.unsupportedViewProjection` | Shadow command resource summary currently supports directional shadow view/projection plans only. | —    | `packages/webgpu/src/shadows/shadow-command-resource-summary.ts` |

## shadowDepthProbe.bindGroupCreationFailed (1)

| Code                                       | Message                                        | Fix? | Emitted from                                        |
| ------------------------------------------ | ---------------------------------------------- | ---- | --------------------------------------------------- |
| `shadowDepthProbe.bindGroupCreationFailed` | Shadow depth probe bind group creation failed. | —    | `packages/webgpu/src/shadows/shadow-depth-probe.ts` |

## shadowDepthProbe.commandSubmissionFailed (1)

| Code                                       | Message                                     | Fix? | Emitted from                                        |
| ------------------------------------------ | ------------------------------------------- | ---- | --------------------------------------------------- |
| `shadowDepthProbe.commandSubmissionFailed` | Shadow depth probe command encoding failed. | —    | `packages/webgpu/src/shadows/shadow-depth-probe.ts` |

## shadowDepthProbe.missingDepthTextureResource (1)

| Code                                           | Message                                                                       | Fix? | Emitted from                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------- | ---- | --------------------------------------------------- |
| `shadowDepthProbe.missingDepthTextureResource` | Shadow depth probing requires a renderer-owned shadow depth texture resource. | —    | `packages/webgpu/src/shadows/shadow-depth-probe.ts` |

## shadowDepthProbe.missingDeviceSupport (1)

| Code                                    | Message                                                                                             | Fix? | Emitted from                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------- |
| `shadowDepthProbe.missingDeviceSupport` | Shadow depth probing requires shader, compute pipeline, buffer, command encoder, and queue support. | —    | `packages/webgpu/src/shadows/shadow-depth-probe.ts` |

## shadowDepthProbe.missingProjectionSamples (1)

| Code                                        | Message                                                                                | Fix? | Emitted from                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------- | ---- | --------------------------------------------------- |
| `shadowDepthProbe.missingProjectionSamples` | Shadow depth probing requires projection coverage samples inside the light projection. | —    | `packages/webgpu/src/shadows/shadow-depth-probe.ts` |

## shadowDepthProbe.missingSamplerResource (1)

| Code                                      | Message                                                            | Fix? | Emitted from                                        |
| ----------------------------------------- | ------------------------------------------------------------------ | ---- | --------------------------------------------------- |
| `shadowDepthProbe.missingSamplerResource` | Shadow depth probing requires a renderer-owned comparison sampler. | —    | `packages/webgpu/src/shadows/shadow-depth-probe.ts` |

## shadowDepthProbe.noStrictPair (1)

| Code                            | Message                                                                                                | Fix? | Emitted from                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------- |
| `shadowDepthProbe.noStrictPair` | Shadow depth probe did not find a receiver/caster pair with a strict shadowed receiver compare result. | —    | `packages/webgpu/src/shadows/shadow-depth-probe.ts` |

## shadowDepthProbe.pipelineCreationFailed (1)

| Code                                      | Message                                              | Fix? | Emitted from                                        |
| ----------------------------------------- | ---------------------------------------------------- | ---- | --------------------------------------------------- |
| `shadowDepthProbe.pipelineCreationFailed` | Shadow depth probe compute pipeline creation failed. | —    | `packages/webgpu/src/shadows/shadow-depth-probe.ts` |

## shadowDepthProbe.readbackFailed (1)

| Code                              | Message                                                        | Fix? | Emitted from                                        |
| --------------------------------- | -------------------------------------------------------------- | ---- | --------------------------------------------------- |
| `shadowDepthProbe.readbackFailed` | Shadow depth probe readback buffer did not expose mapped data. | —    | `packages/webgpu/src/shadows/shadow-depth-probe.ts` |

## shadowDepthProbe.shadowPassNotSubmitted (1)

| Code                                      | Message                                                                                      | Fix? | Emitted from                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------- |
| `shadowDepthProbe.shadowPassNotSubmitted` | Shadow depth probing requires the shadow pass command buffer to be submitted before probing. | —    | `packages/webgpu/src/shadows/shadow-depth-probe.ts` |

## shadowDepthResourceSummary.depthTextureResourceMissing (1)

| Code                                                     | Message                                                                          | Fix? | Emitted from                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadowDepthResourceSummary.depthTextureResourceMissing` | Shadow depth resource summary requires available shadow depth texture resources. | —    | `packages/webgpu/src/shadows/shadow-depth-resource-summary.ts` |

## shadowDepthResourceSummary.matrixUploadDeferred (1)

| Code                                              | Message                                                                                  | Fix? | Emitted from                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadowDepthResourceSummary.matrixUploadDeferred` | Shadow depth texture resources are available, but shadow matrix upload remains deferred. | —    | `packages/webgpu/src/shadows/shadow-depth-resource-summary.ts` |

## shadowDepthResourceSummary.passSubmissionDeferred (1)

| Code                                                | Message                                                                                    | Fix? | Emitted from                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `shadowDepthResourceSummary.passSubmissionDeferred` | Shadow depth texture resources are available, but shadow pass submission remains deferred. | —    | `packages/webgpu/src/shadows/shadow-depth-resource-summary.ts` |

## shadowDepthResourceSummary.shaderSamplingDeferred (1)

| Code                                                | Message                                                                                              | Fix? | Emitted from                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadowDepthResourceSummary.shaderSamplingDeferred` | Shadow depth texture resources are available, but StandardMaterial shadow sampling remains deferred. | —    | `packages/webgpu/src/shadows/shadow-depth-resource-summary.ts` |

## shadowDepthTextureResource.faceViewCreationFailed (1)

| Code                                                | Message                       | Fix? | Emitted from                                                   |
| --------------------------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------- |
| `shadowDepthTextureResource.faceViewCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/shadows/shadow-depth-texture-resource.ts` |

## shadowDepthTextureResource.missingTextureDescriptors (1)

| Code                                                   | Message                       | Fix? | Emitted from                                                   |
| ------------------------------------------------------ | ----------------------------- | ---- | -------------------------------------------------------------- |
| `shadowDepthTextureResource.missingTextureDescriptors` | (message composed at runtime) | —    | `packages/webgpu/src/shadows/shadow-depth-texture-resource.ts` |

## shadowMapDescriptor.invalidMapSize (1)

| Code                                 | Message                                             | Fix? | Emitted from                                           |
| ------------------------------------ | --------------------------------------------------- | ---- | ------------------------------------------------------ |
| `shadowMapDescriptor.invalidMapSize` | Shadow-map descriptor '…' has invalid map size '…'. | —    | `packages/webgpu/src/shadows/shadow-map-descriptor.ts` |

## shadowMapDescriptor.missingDescriptor (1)

| Code                                    | Message                                                                       | Fix? | Emitted from                                           |
| --------------------------------------- | ----------------------------------------------------------------------------- | ---- | ------------------------------------------------------ |
| `shadowMapDescriptor.missingDescriptor` | Shadow request '…' for light '…' has no renderer-owned shadow-map descriptor. | —    | `packages/webgpu/src/shadows/shadow-map-descriptor.ts` |

## shadowMatrixBuffer.missingViewProjectionPlan (1)

| Code                                           | Message                                                               | Fix? | Emitted from                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowMatrixBuffer.missingViewProjectionPlan` | Shadow matrix buffer planning requires a shadow view/projection plan. | —    | `packages/webgpu/src/shadows/shadow-matrix-buffer-descriptor.ts` |

## shadowMatrixBuffer.unsupportedViewProjectionPlan (1)

| Code                                               | Message                                                                                 | Fix? | Emitted from                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowMatrixBuffer.unsupportedViewProjectionPlan` | Shadow matrix buffer planning does not support the current shadow view/projection plan. | —    | `packages/webgpu/src/shadows/shadow-matrix-buffer-descriptor.ts` |

## shadowMatrixBuffer.uploadDeferred (1)

| Code                                | Message                                                                                               | Fix? | Emitted from                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `shadowMatrixBuffer.uploadDeferred` | Shadow matrix buffer descriptor is planned, but GPU buffer allocation and matrix upload are deferred. | —    | `packages/webgpu/src/shadows/shadow-matrix-buffer-descriptor.ts` |

## shadowMatrixBufferResource.bindGroupDeferred (1)

| Code                                           | Message                                                                                 | Fix? | Emitted from                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadowMatrixBufferResource.bindGroupDeferred` | Shadow matrix buffer resource is available, but shadow bind-group creation is deferred. | —    | `packages/webgpu/src/shadows/shadow-matrix-buffer-resource.ts` |

## shadowMatrixBufferResource.bufferCreationFailed (1)

| Code                                              | Message                       | Fix? | Emitted from                                                   |
| ------------------------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------- |
| `shadowMatrixBufferResource.bufferCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/shadows/shadow-matrix-buffer-resource.ts` |

## shadowMatrixBufferResource.missingDescriptor (1)

| Code                                           | Message                                                                       | Fix? | Emitted from                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadowMatrixBufferResource.missingDescriptor` | Shadow matrix buffer resource allocation requires a matrix buffer descriptor. | —    | `packages/webgpu/src/shadows/shadow-matrix-buffer-resource.ts` |

## shadowMatrixBufferResource.missingMatrices (1)

| Code                                         | Message                                                                                 | Fix? | Emitted from                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadowMatrixBufferResource.missingMatrices` | Shadow matrix buffer resource allocation requires computed directional shadow matrices. | —    | `packages/webgpu/src/shadows/shadow-matrix-buffer-resource.ts` |

## shadowMatrixBufferResource.missingMatrixData (1)

| Code                                           | Message                                            | Fix? | Emitted from                                                   |
| ---------------------------------------------- | -------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadowMatrixBufferResource.missingMatrixData` | Shadow matrix '…' is missing computed matrix data. | —    | `packages/webgpu/src/shadows/shadow-matrix-buffer-resource.ts` |

## shadowMatrixBufferResource.shaderSamplingDeferred (1)

| Code                                                | Message                                                                                       | Fix? | Emitted from                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `shadowMatrixBufferResource.shaderSamplingDeferred` | Shadow matrix buffer resource is available, but StandardMaterial shadow sampling is deferred. | —    | `packages/webgpu/src/shadows/shadow-matrix-buffer-resource.ts` |

## shadowPassAttachmentDescriptor.missingDepthView (1)

| Code                                              | Message                                                                                                    | Fix? | Emitted from                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowPassAttachmentDescriptor.missingDepthView` | Shadow pass depth attachments are planned, but command encoder execution and pass submission are deferred. | —    | `packages/webgpu/src/shadows/shadow-pass-attachment-descriptor.ts` |

## shadowPassAttachmentDescriptor.missingPassPlan (1)

| Code                                             | Message                                                                | Fix? | Emitted from                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowPassAttachmentDescriptor.missingPassPlan` | Shadow pass attachment descriptor planning requires shadow pass plans. | —    | `packages/webgpu/src/shadows/shadow-pass-attachment-descriptor.ts` |

## shadowPassAttachmentDescriptor.passSubmissionDeferred (1)

| Code                                                    | Message                                                                                                    | Fix? | Emitted from                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `shadowPassAttachmentDescriptor.passSubmissionDeferred` | Shadow pass depth attachments are planned, but command encoder execution and pass submission are deferred. | —    | `packages/webgpu/src/shadows/shadow-pass-attachment-descriptor.ts` |

## shadowPassCommandBufferSubmission.finishFailed (1)

| Code                                             | Message                                                              | Fix? | Emitted from                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `shadowPassCommandBufferSubmission.finishFailed` | Shadow command buffer is finished, but queue submission is deferred. | —    | `packages/webgpu/src/shadows/shadow-pass-command-buffer-submission-report.ts` |

## shadowPassCommandBufferSubmission.missingCommandEncoder (1)

| Code                                                      | Message                                                                                      | Fix? | Emitted from                                                                  |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `shadowPassCommandBufferSubmission.missingCommandEncoder` | Shadow command-buffer submission requires the command encoder used for shadow pass assembly. | —    | `packages/webgpu/src/shadows/shadow-pass-command-buffer-submission-report.ts` |

## shadowPassCommandBufferSubmission.missingEncoderAssembly (1)

| Code                                                       | Message                                                                       | Fix? | Emitted from                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `shadowPassCommandBufferSubmission.missingEncoderAssembly` | Shadow command-buffer submission requires at least one assembled shadow pass. | —    | `packages/webgpu/src/shadows/shadow-pass-command-buffer-submission-report.ts` |

## shadowPassCommandBufferSubmission.queueSubmissionDeferred (1)

| Code                                                        | Message                                                              | Fix? | Emitted from                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `shadowPassCommandBufferSubmission.queueSubmissionDeferred` | Shadow command buffer is finished, but queue submission is deferred. | —    | `packages/webgpu/src/shadows/shadow-pass-command-buffer-submission-report.ts` |

## shadowPassCommandBufferSubmission.shaderSamplingDeferred (1)

| Code                                                       | Message                                                                            | Fix? | Emitted from                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `shadowPassCommandBufferSubmission.shaderSamplingDeferred` | Shadow command buffer submission does not enable StandardMaterial shadow sampling. | —    | `packages/webgpu/src/shadows/shadow-pass-command-buffer-submission-report.ts` |

## shadowPassCommandBufferSubmission.submitFailed (1)

| Code                                             | Message                       | Fix? | Emitted from                                                                  |
| ------------------------------------------------ | ----------------------------- | ---- | ----------------------------------------------------------------------------- |
| `shadowPassCommandBufferSubmission.submitFailed` | (message composed at runtime) | —    | `packages/webgpu/src/shadows/shadow-pass-command-buffer-submission-report.ts` |

## shadowPassCommandEncoding.commandEncodingDeferred (1)

| Code                                                | Message                                                                             | Fix? | Emitted from                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `shadowPassCommandEncoding.commandEncodingDeferred` | Shadow pass command records are available, but WebGPU command encoding is deferred. | —    | `packages/webgpu/src/shadows/shadow-pass-command-encoding-report.ts` |

## shadowPassCommandEncoding.missingCasterDrawList (1)

| Code                                              | Message                                           | Fix? | Emitted from                                                         |
| ------------------------------------------------- | ------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `shadowPassCommandEncoding.missingCasterDrawList` | Shadow pass '…' has no matching caster draw list. | —    | `packages/webgpu/src/shadows/shadow-pass-command-encoding-report.ts` |

## shadowPassCommandEncoding.missingCommandPlan (1)

| Code                                           | Message                                                                             | Fix? | Emitted from                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `shadowPassCommandEncoding.missingCommandPlan` | Shadow pass command records are available, but WebGPU command encoding is deferred. | —    | `packages/webgpu/src/shadows/shadow-pass-command-encoding-report.ts` |

## shadowPassCommandEncoding.missingDepthView (1)

| Code                                         | Message                                                      | Fix? | Emitted from                                                         |
| -------------------------------------------- | ------------------------------------------------------------ | ---- | -------------------------------------------------------------------- |
| `shadowPassCommandEncoding.missingDepthView` | Shadow pass '…' requires a live depth texture view resource. | —    | `packages/webgpu/src/shadows/shadow-pass-command-encoding-report.ts` |

## shadowPassCommandEncoding.missingMatrixBuffer (1)

| Code                                            | Message                                                                          | Fix? | Emitted from                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `shadowPassCommandEncoding.missingMatrixBuffer` | Shadow pass command encoding requires an uploaded shadow matrix buffer resource. | —    | `packages/webgpu/src/shadows/shadow-pass-command-encoding-report.ts` |

## shadowPassCommandEncoding.missingPassPlan (1)

| Code                                        | Message                                                       | Fix? | Emitted from                                                         |
| ------------------------------------------- | ------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `shadowPassCommandEncoding.missingPassPlan` | Shadow pass command encoding requires at least one pass plan. | —    | `packages/webgpu/src/shadows/shadow-pass-command-encoding-report.ts` |

## shadowPassEncoderAssembly.beginFailed (1)

| Code                                    | Message                       | Fix? | Emitted from                                                         |
| --------------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------------- |
| `shadowPassEncoderAssembly.beginFailed` | (message composed at runtime) | —    | `packages/webgpu/src/shadows/shadow-pass-encoder-assembly-report.ts` |

## shadowPassEncoderAssembly.commandBufferSubmissionDeferred (1)

| Code                                                        | Message                                                                                          | Fix? | Emitted from                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------- |
| `shadowPassEncoderAssembly.commandBufferSubmissionDeferred` | Shadow pass encoders are assembled, but command-buffer finish and queue submission are deferred. | —    | `packages/webgpu/src/shadows/shadow-pass-encoder-assembly-report.ts` |

## shadowPassEncoderAssembly.commandExecutionFailed (1)

| Code                                               | Message                       | Fix? | Emitted from                                                         |
| -------------------------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------------- |
| `shadowPassEncoderAssembly.commandExecutionFailed` | (message composed at runtime) | —    | `packages/webgpu/src/shadows/shadow-pass-encoder-assembly-report.ts` |

## shadowPassEncoderAssembly.endFailed (1)

| Code                                  | Message                       | Fix? | Emitted from                                                         |
| ------------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------------- |
| `shadowPassEncoderAssembly.endFailed` | (message composed at runtime) | —    | `packages/webgpu/src/shadows/shadow-pass-encoder-assembly-report.ts` |

## shadowPassEncoderAssembly.frameResourcesNotReady (1)

| Code                                               | Message                                                             | Fix? | Emitted from                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `shadowPassEncoderAssembly.frameResourcesNotReady` | Shadow pass encoder assembly requires ready caster frame resources. | —    | `packages/webgpu/src/shadows/shadow-pass-encoder-assembly-report.ts` |

## shadowPassEncoderAssembly.missingAttachmentDescriptors (1)

| Code                                                     | Message                                                             | Fix? | Emitted from                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `shadowPassEncoderAssembly.missingAttachmentDescriptors` | Shadow pass encoder assembly requires depth attachment descriptors. | —    | `packages/webgpu/src/shadows/shadow-pass-encoder-assembly-report.ts` |

## shadowPassEncoderAssembly.missingCommandEncoder (1)

| Code                                              | Message                                                            | Fix? | Emitted from                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------ | ---- | -------------------------------------------------------------------- |
| `shadowPassEncoderAssembly.missingCommandEncoder` | Shadow pass encoder assembly requires an injected command encoder. | —    | `packages/webgpu/src/shadows/shadow-pass-encoder-assembly-report.ts` |

## shadowPassEncoderAssembly.missingCommandRecords (1)

| Code                                              | Message                                                            | Fix? | Emitted from                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------ | ---- | -------------------------------------------------------------------- |
| `shadowPassEncoderAssembly.missingCommandRecords` | Shadow pass encoder assembly requires shadow pass command records. | —    | `packages/webgpu/src/shadows/shadow-pass-encoder-assembly-report.ts` |

## shadowPassEncoderAssembly.missingDepthView (1)

| Code                                         | Message                                                      | Fix? | Emitted from                                                         |
| -------------------------------------------- | ------------------------------------------------------------ | ---- | -------------------------------------------------------------------- |
| `shadowPassEncoderAssembly.missingDepthView` | Shadow pass '…' has no live depth view for encoder assembly. | —    | `packages/webgpu/src/shadows/shadow-pass-encoder-assembly-report.ts` |

## shadowPassPlan.missingShadowRequest (1)

| Code                                  | Message                                                                   | Fix? | Emitted from                                      |
| ------------------------------------- | ------------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| `shadowPassPlan.missingShadowRequest` | Shadow pass submission is not supported for the planned shadow resources. | —    | `packages/webgpu/src/shadows/shadow-pass-plan.ts` |

## shadowPassPlan.missingTextureResources (1)

| Code                                     | Message                                                                                 | Fix? | Emitted from                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| `shadowPassPlan.missingTextureResources` | Shadow pass planning requires valid renderer-owned shadow texture resource descriptors. | —    | `packages/webgpu/src/shadows/shadow-pass-plan.ts` |

## shadowPassPlan.submissionDeferred (1)

| Code                                | Message                                                                                 | Fix? | Emitted from                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| `shadowPassPlan.submissionDeferred` | Shadow pass descriptors are planned, but GPU command submission is not implemented yet. | —    | `packages/webgpu/src/shadows/shadow-pass-plan.ts` |

## shadowPassPlan.submissionUnsupported (1)

| Code                                   | Message                                                                   | Fix? | Emitted from                                      |
| -------------------------------------- | ------------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| `shadowPassPlan.submissionUnsupported` | Shadow pass submission is not supported for the planned shadow resources. | —    | `packages/webgpu/src/shadows/shadow-pass-plan.ts` |

## shadowResourceReadiness.missingDescriptors (1)

| Code                                         | Message                                                                         | Fix? | Emitted from                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `shadowResourceReadiness.missingDescriptors` | Shadow resource readiness requires valid renderer-owned shadow-map descriptors. | —    | `packages/webgpu/src/shadows/shadow-resource-readiness.ts` |

## shadowResourceReadiness.passSubmissionDeferred (1)

| Code                                             | Message                                                                                                          | Fix? | Emitted from                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------- |
| `shadowResourceReadiness.passSubmissionDeferred` | Shadow-map descriptors are available, but shadow texture allocation and pass submission are not implemented yet. | —    | `packages/webgpu/src/shadows/shadow-resource-readiness.ts` |

## shadowSamplerResource.bindGroupDeferred (1)

| Code                                      | Message                                                                                                   | Fix? | Emitted from                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `shadowSamplerResource.bindGroupDeferred` | Shadow sampler resources are live, but StandardMaterial shadow bind-group creation is tracked separately. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## shadowSamplerResource.createSamplerUnavailable (1)

| Code                                             | Message                                      | Fix? | Emitted from                                                                    |
| ------------------------------------------------ | -------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `shadowSamplerResource.createSamplerUnavailable` | WebGPU device cannot create shadow samplers. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## shadowSamplerResource.creationFailed (1)

| Code                                   | Message                                                                                        | Fix? | Emitted from                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `shadowSamplerResource.creationFailed` | StandardMaterial shadow bind-group descriptor planning requires valid group 5 layout metadata. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## shadowSamplerResource.shaderSamplingDeferred (1)

| Code                                           | Message                                                                  | Fix? | Emitted from                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------- |
| `shadowSamplerResource.shaderSamplingDeferred` | Shadow sampler resources are live, but WGSL shadow sampling is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## shadowTextureResource.allocationDeferred (1)

| Code                                       | Message                                                                                         | Fix? | Emitted from                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `shadowTextureResource.allocationDeferred` | Shadow texture descriptors are planned, but live GPU texture allocation is not implemented yet. | —    | `packages/webgpu/src/shadows/shadow-texture-resource.ts` |

## shadowTextureResource.missingDescriptors (1)

| Code                                       | Message                                                                 | Fix? | Emitted from                                             |
| ------------------------------------------ | ----------------------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `shadowTextureResource.missingDescriptors` | Shadow texture resource planning requires valid shadow-map descriptors. | —    | `packages/webgpu/src/shadows/shadow-texture-resource.ts` |

## skinningJointBuffer.invalidUsageFlags (1)

| Code                                    | Message                                                                      | Fix? | Emitted from                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `skinningJointBuffer.invalidUsageFlags` | Skinning joint matrix storage-buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/attributes/skinning-joint-buffer.ts` |

## skinningJointBuffer.missingCount (1)

| Code                               | Message                                                       | Fix? | Emitted from                                                        |
| ---------------------------------- | ------------------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `skinningJointBuffer.missingCount` | Render id … is skinned but has no positive bone matrix count. | —    | `packages/webgpu/src/resources/attributes/skinning-joint-buffer.ts` |

## skinningJointBuffer.missingData (1)

| Code                              | Message                                                                              | Fix? | Emitted from                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------- |
| `skinningJointBuffer.missingData` | Render id … references bone matrices …..…, but the snapshot bone buffer length is …. | —    | `packages/webgpu/src/resources/attributes/skinning-joint-buffer.ts` |

## skinningJointBuffer.missingOffset (1)

| Code                                | Message                                                                             | Fix? | Emitted from                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `skinningJointBuffer.missingOffset` | Standard frame GPU resource creation requires a draw packet for a skinned pipeline. | —    | `packages/webgpu/src/materials/standard/standard-frame-base-resources.ts`<br>`packages/webgpu/src/resources/attributes/skinning-joint-buffer.ts` |

## skinningJointBuffer.notSkinned (1)

| Code                             | Message                                                                      | Fix? | Emitted from                                                        |
| -------------------------------- | ---------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `skinningJointBuffer.notSkinned` | Skinning joint matrix storage-buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/attributes/skinning-joint-buffer.ts` |

## skinningJointGpuBuffer.creationFailed (1)

| Code                                    | Message                                       | Fix? | Emitted from                                                        |
| --------------------------------------- | --------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `skinningJointGpuBuffer.creationFailed` | Failed to create skinning joint buffer '…': … | —    | `packages/webgpu/src/resources/attributes/skinning-joint-buffer.ts` |

## skinningJointGpuBuffer.nullDescriptorPlan (1)

| Code                                        | Message                                                                | Fix? | Emitted from                                                        |
| ------------------------------------------- | ---------------------------------------------------------------------- | ---- | ------------------------------------------------------------------- |
| `skinningJointGpuBuffer.nullDescriptorPlan` | Cannot create a skinning joint GPU buffer from a null descriptor plan. | —    | `packages/webgpu/src/resources/attributes/skinning-joint-buffer.ts` |

## skybox.invalidIntensity (1)

| Code                      | Message                                                | Fix? | Emitted from                                                    |
| ------------------------- | ------------------------------------------------------ | ---- | --------------------------------------------------------------- |
| `skybox.invalidIntensity` | Skybox intensity must be a finite non-negative number. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## skybox.invalidTexture (1)

| Code                    | Message                                 | Fix? | Emitted from                                                    |
| ----------------------- | --------------------------------------- | ---- | --------------------------------------------------------------- |
| `skybox.invalidTexture` | Skyboxes require a cube texture handle. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## skyboxFrame.createBindGroupUnavailable (1)

| Code                                     | Message                                         | Fix? | Emitted from                        |
| ---------------------------------------- | ----------------------------------------------- | ---- | ----------------------------------- |
| `skyboxFrame.createBindGroupUnavailable` | WebGPU device cannot create skybox bind groups. | —    | `packages/webgpu/src/app/skybox.ts` |

## skyboxFrame.invalidIntensity (1)

| Code                           | Message                                             | Fix? | Emitted from                        |
| ------------------------------ | --------------------------------------------------- | ---- | ----------------------------------- |
| `skyboxFrame.invalidIntensity` | Skybox … intensity must be finite and non-negative. | —    | `packages/webgpu/src/app/skybox.ts` |

## skyboxFrame.missingPipelineLayouts (1)

| Code                                 | Message                                             | Fix? | Emitted from                        |
| ------------------------------------ | --------------------------------------------------- | ---- | ----------------------------------- |
| `skyboxFrame.missingPipelineLayouts` | Skybox pipeline does not expose bind group layouts. | —    | `packages/webgpu/src/app/skybox.ts` |

## skyboxFrame.viewMatrixOutOfRange (1)

| Code                               | Message                                                                  | Fix? | Emitted from                        |
| ---------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------- |
| `skyboxFrame.viewMatrixOutOfRange` | Skybox view … view matrix offset … is outside snapshot view matrix data. | —    | `packages/webgpu/src/app/skybox.ts` |

## skyboxFrame.viewProjectionNotInvertible (1)

| Code                                      | Message                                                    | Fix? | Emitted from                        |
| ----------------------------------------- | ---------------------------------------------------------- | ---- | ----------------------------------- |
| `skyboxFrame.viewProjectionNotInvertible` | Skybox view … has a non-invertible view-projection matrix. | —    | `packages/webgpu/src/app/skybox.ts` |

## skyboxFrame.viewProjectionOutOfRange (1)

| Code                                   | Message                                                                             | Fix? | Emitted from                        |
| -------------------------------------- | ----------------------------------------------------------------------------------- | ---- | ----------------------------------- |
| `skyboxFrame.viewProjectionOutOfRange` | Skybox view … view-projection matrix offset … is outside snapshot view matrix data. | —    | `packages/webgpu/src/app/skybox.ts` |

## skyboxRenderPipeline.createRenderPipelineUnavailable (1)

| Code                                                   | Message                                              | Fix? | Emitted from                                           |
| ------------------------------------------------------ | ---------------------------------------------------- | ---- | ------------------------------------------------------ |
| `skyboxRenderPipeline.createRenderPipelineUnavailable` | WebGPU device cannot create skybox render pipelines. | —    | `packages/webgpu/src/render/skybox/skybox-pipeline.ts` |

## skyboxRenderPipeline.pipelineCreationFailed (1)

| Code                                          | Message                       | Fix? | Emitted from                                           |
| --------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------ |
| `skyboxRenderPipeline.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/render/skybox/skybox-pipeline.ts` |

## skyboxRenderPipeline.shaderCreationFailed (1)

| Code                                        | Message                                              | Fix? | Emitted from                                           |
| ------------------------------------------- | ---------------------------------------------------- | ---- | ------------------------------------------------------ |
| `skyboxRenderPipeline.shaderCreationFailed` | WebGPU device cannot create skybox render pipelines. | —    | `packages/webgpu/src/render/skybox/skybox-pipeline.ts` |

## skyboxRenderPipeline.shaderDiagnostic (1)

| Code                                    | Message                       | Fix? | Emitted from                                           |
| --------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------ |
| `skyboxRenderPipeline.shaderDiagnostic` | (message composed at runtime) | —    | `packages/webgpu/src/render/skybox/skybox-pipeline.ts` |

## spatial.mesh (5)

| Code                                       | Message                                                                                            | Fix? | Emitted from                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------ |
| `spatial.mesh.empty`                       | (message composed at runtime)                                                                      | —    | `packages/app/src/systems/spatial-index-population.ts` |
| `spatial.mesh.missing-position`            | Mesh '…' cannot be queried because it has no POSITION attribute.                                   | yes  | `packages/render/src/mesh/spatial-adapter.ts`          |
| `spatial.mesh.unsupported-index-format`    | Mesh '…' index format '…' is not supported for CPU spatial queries.                                | yes  | `packages/render/src/mesh/spatial-adapter.ts`          |
| `spatial.mesh.unsupported-position-format` | Mesh '…' POSITION format '…' is not supported for CPU spatial queries.                             | yes  | `packages/render/src/mesh/spatial-adapter.ts`          |
| `spatial.mesh.unsupported-topology`        | Mesh '…' submesh '…' uses topology '…', but CPU mesh queries currently support triangle-list only. | yes  | `packages/render/src/mesh/spatial-adapter.ts`          |

## spatial.mesh-bvh (5)

| Code                                    | Message                                                                        | Fix? | Emitted from                                  |
| --------------------------------------- | ------------------------------------------------------------------------------ | ---- | --------------------------------------------- |
| `spatial.mesh-bvh.build-failed`         | Mesh BVH build failed.                                                         | yes  | `packages/simulation/src/spatial/mesh-bvh.ts` |
| `spatial.mesh-bvh.stale`                | BVH cache entry for mesh '…' is stale for version '…'.                         | yes  | `packages/simulation/src/spatial/mesh-bvh.ts` |
| `spatial.mesh-bvh.unsupported-morphed`  | Mesh '…' is morphed; exact deformed BVH queries are not active for this asset. | yes  | `packages/simulation/src/spatial/mesh-bvh.ts` |
| `spatial.mesh-bvh.unsupported-skinned`  | Mesh '…' is skinned; exact deformed BVH queries are not active for this asset. | yes  | `packages/simulation/src/spatial/mesh-bvh.ts` |
| `spatial.mesh-bvh.unsupported-topology` | Mesh '…' uses topology that the mesh BVH cannot query exactly.                 | yes  | `packages/simulation/src/spatial/mesh-bvh.ts` |

## spotShadowMatrix.invalidLightDirection (1)

| Code                                     | Message                                                 | Fix? | Emitted from                                                    |
| ---------------------------------------- | ------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `spotShadowMatrix.invalidLightDirection` | Spot shadow plan '…' has a zero-length light direction. | —    | `packages/webgpu/src/shadows/spot-shadow-matrix-computation.ts` |

## spotShadowMatrix.missingLightTransform (1)

| Code                                     | Message                                                           | Fix? | Emitted from                                                    |
| ---------------------------------------- | ----------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `spotShadowMatrix.missingLightTransform` | Spot shadow plan '…' references missing light transform offset …. | —    | `packages/webgpu/src/shadows/spot-shadow-matrix-computation.ts` |

## spotShadowMatrix.missingViewProjectionPlan (1)

| Code                                         | Message                                                           | Fix? | Emitted from                                                    |
| -------------------------------------------- | ----------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `spotShadowMatrix.missingViewProjectionPlan` | Spot shadow matrix computation requires view/projection planning. | —    | `packages/webgpu/src/shadows/spot-shadow-matrix-computation.ts` |

## spotShadowMatrix.unsupportedViewProjectionPlan (1)

| Code                                             | Message                                                         | Fix? | Emitted from                                                    |
| ------------------------------------------------ | --------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `spotShadowMatrix.unsupportedViewProjectionPlan` | Spot shadow matrix computation only supports spot shadow plans. | —    | `packages/webgpu/src/shadows/spot-shadow-matrix-computation.ts` |

## spotShadowViewProjection.matrixDeferred (1)

| Code                                      | Message                                                                                      | Fix? | Emitted from                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `spotShadowViewProjection.matrixDeferred` | Spot shadow view/projection keys are planned, but matrix computation is not implemented yet. | —    | `packages/webgpu/src/shadows/spot-shadow-view-projection-plan.ts` |

## spotShadowViewProjection.missingLight (1)

| Code                                    | Message                                               | Fix? | Emitted from                                                      |
| --------------------------------------- | ----------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `spotShadowViewProjection.missingLight` | Spot shadow request '…' references missing light '…'. | —    | `packages/webgpu/src/shadows/spot-shadow-view-projection-plan.ts` |

## spotShadowViewProjection.missingPassPlan (1)

| Code                                       | Message                                                   | Fix? | Emitted from                                                      |
| ------------------------------------------ | --------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `spotShadowViewProjection.missingPassPlan` | Spot shadow request '…' has no matching shadow pass plan. | —    | `packages/webgpu/src/shadows/spot-shadow-view-projection-plan.ts` |

## spotShadowViewProjection.unsupportedLightKind (1)

| Code                                            | Message                                                        | Fix? | Emitted from                                                      |
| ----------------------------------------------- | -------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `spotShadowViewProjection.unsupportedLightKind` | Spot shadow request '…' references unsupported light kind '…'. | —    | `packages/webgpu/src/shadows/spot-shadow-view-projection-plan.ts` |

## sprite.invalidAtlasFrame (1)

| Code                       | Message                                           | Fix? | Emitted from                                                    |
| -------------------------- | ------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `sprite.invalidAtlasFrame` | Sprite atlasFrame must be a non-negative integer. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## sprite.invalidBillboardMode (1)

| Code                          | Message                                                                            | Fix? | Emitted from                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `sprite.invalidBillboardMode` | Sprite billboardMode must be 'none', 'spherical', 'cylindrical', or 'axis-locked'. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## sprite.invalidBlendMode (1)

| Code                      | Message                                                                | Fix? | Emitted from                                                    |
| ------------------------- | ---------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `sprite.invalidBlendMode` | Sprite blendMode must be 'opaque', 'alpha', 'additive', or 'multiply'. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## sprite.invalidCoordinateMode (1)

| Code                           | Message                                            | Fix? | Emitted from                                                    |
| ------------------------------ | -------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `sprite.invalidCoordinateMode` | Sprite coordinateMode must be 'world' or 'screen'. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## sprite.invalidDepthMode (1)

| Code                      | Message                                        | Fix? | Emitted from                                                    |
| ------------------------- | ---------------------------------------------- | ---- | --------------------------------------------------------------- |
| `sprite.invalidDepthMode` | Sprite depthMode must be 'test' or 'disabled'. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## sprite.invalidPivot (1)

| Code                  | Message                                     | Fix? | Emitted from                                                    |
| --------------------- | ------------------------------------------- | ---- | --------------------------------------------------------------- |
| `sprite.invalidPivot` | Sprite pivot values must be finite numbers. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## sprite.invalidRotation (1)

| Code                     | Message                                  | Fix? | Emitted from                                                    |
| ------------------------ | ---------------------------------------- | ---- | --------------------------------------------------------------- |
| `sprite.invalidRotation` | Sprite rotation must be a finite number. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## sprite.invalidSize (1)

| Code                 | Message                                           | Fix? | Emitted from                                                    |
| -------------------- | ------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `sprite.invalidSize` | Sprites require finite positive width and height. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## sprite.invalidSizeMode (1)

| Code                     | Message                                                   | Fix? | Emitted from                                                    |
| ------------------------ | --------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `sprite.invalidSizeMode` | Sprite sizeMode must be 'world-units' or 'screen-pixels'. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## sprite.invalidTexture (1)

| Code                    | Message                           | Fix? | Emitted from                                                    |
| ----------------------- | --------------------------------- | ---- | --------------------------------------------------------------- |
| `sprite.invalidTexture` | Sprites require a texture handle. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## sprite.invalidUvRect (1)

| Code                   | Message                                                                 | Fix? | Emitted from                                                    |
| ---------------------- | ----------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `sprite.invalidUvRect` | Sprite uvRect values must be finite with non-negative width and height. | —    | `packages/render/src/rendering/authoring-validation-effects.ts` |

## spriteFrame.createBindGroupUnavailable (1)

| Code                                     | Message                                         | Fix? | Emitted from                         |
| ---------------------------------------- | ----------------------------------------------- | ---- | ------------------------------------ |
| `spriteFrame.createBindGroupUnavailable` | WebGPU device cannot create sprite bind groups. | —    | `packages/webgpu/src/app/sprites.ts` |

## spriteFrame.missingPipelineLayouts (1)

| Code                                 | Message                                             | Fix? | Emitted from                         |
| ------------------------------------ | --------------------------------------------------- | ---- | ------------------------------------ |
| `spriteFrame.missingPipelineLayouts` | Sprite pipeline does not expose bind group layouts. | —    | `packages/webgpu/src/app/sprites.ts` |

## spriteFrame.quadBatchMissingTexture (1)

| Code                                  | Message                                            | Fix? | Emitted from                         |
| ------------------------------------- | -------------------------------------------------- | ---- | ------------------------------------ |
| `spriteFrame.quadBatchMissingTexture` | Sprite quad batch … is missing its texture handle. | —    | `packages/webgpu/src/app/sprites.ts` |

## spriteRenderPipeline.createRenderPipelineUnavailable (1)

| Code                                                   | Message                                              | Fix? | Emitted from                                            |
| ------------------------------------------------------ | ---------------------------------------------------- | ---- | ------------------------------------------------------- |
| `spriteRenderPipeline.createRenderPipelineUnavailable` | WebGPU device cannot create sprite render pipelines. | —    | `packages/webgpu/src/render/sprites/sprite-pipeline.ts` |

## spriteRenderPipeline.pipelineCreationFailed (1)

| Code                                          | Message                       | Fix? | Emitted from                                            |
| --------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------- |
| `spriteRenderPipeline.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/render/sprites/sprite-pipeline.ts` |

## spriteRenderPipeline.shaderCreationFailed (1)

| Code                                        | Message                                              | Fix? | Emitted from                                            |
| ------------------------------------------- | ---------------------------------------------------- | ---- | ------------------------------------------------------- |
| `spriteRenderPipeline.shaderCreationFailed` | WebGPU device cannot create sprite render pipelines. | —    | `packages/webgpu/src/render/sprites/sprite-pipeline.ts` |

## spriteRenderPipeline.shaderDiagnostic (1)

| Code                                    | Message                       | Fix? | Emitted from                                            |
| --------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------- |
| `spriteRenderPipeline.shaderDiagnostic` | (message composed at runtime) | —    | `packages/webgpu/src/render/sprites/sprite-pipeline.ts` |

## standardFrameResources.missingInstanceTints (1)

| Code                                          | Message                                                                                            | Fix? | Emitted from                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `standardFrameResources.missingInstanceTints` | Standard frame GPU resource creation requires packed instance tints for an instance-tint pipeline. | —    | `packages/webgpu/src/materials/standard/standard-frame-base-resources.ts` |

## standardFrameResources.missingLights (1)

| Code                                   | Message                                                                     | Fix? | Emitted from                                                         |
| -------------------------------------- | --------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `standardFrameResources.missingLights` | Standard frame GPU resource creation requires at least one extracted light. | —    | `packages/webgpu/src/materials/standard/standard-frame-resources.ts` |

## standardFrameResources.missingMaterial (1)

| Code                                     | Message                                                                  | Fix? | Emitted from                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------- |
| `standardFrameResources.missingMaterial` | Standard frame GPU resource creation requires a standard material asset. | —    | `packages/webgpu/src/materials/standard/standard-frame-base-resources.ts` |

## standardFrameResources.missingMesh (1)

| Code                                 | Message                                                     | Fix? | Emitted from                                                              |
| ------------------------------------ | ----------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `standardFrameResources.missingMesh` | Standard frame GPU resource creation requires a mesh asset. | —    | `packages/webgpu/src/materials/standard/standard-frame-base-resources.ts` |

## standardFrameResources.missingViewUniforms (1)

| Code                                         | Message                                                             | Fix? | Emitted from                                                              |
| -------------------------------------------- | ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `standardFrameResources.missingViewUniforms` | Standard frame GPU resource creation requires packed view uniforms. | —    | `packages/webgpu/src/materials/standard/standard-frame-base-resources.ts` |

## standardFrameResources.missingWorldTransforms (1)

| Code                                            | Message                                                                | Fix? | Emitted from                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `standardFrameResources.missingWorldTransforms` | Standard frame GPU resource creation requires packed world transforms. | —    | `packages/webgpu/src/materials/standard/standard-frame-base-resources.ts` |

## standardLightShadowBindGroup.missingDepthTextureResource (1)

| Code                                                       | Message                                                                                     | Fix? | Emitted from                                                                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standardLightShadowBindGroup.missingDepthTextureResource` | StandardMaterial light/shadow/IBL bind-group planning requires a shadow depth texture view. | —    | `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group-entries.ts`<br>`packages/webgpu/src/materials/standard/standard-light-shadow-bind-group.ts` |

## standardLightShadowBindGroup.missingDiffuseIblTextureResource (1)

| Code                                                            | Message                                                                             | Fix? | Emitted from                                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardLightShadowBindGroup.missingDiffuseIblTextureResource` | StandardMaterial light/IBL bind-group planning requires a diffuse IBL texture view. | —    | `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group.ts` |

## standardLightShadowBindGroup.missingIblSamplerResource (1)

| Code                                                     | Message                                                                 | Fix? | Emitted from                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardLightShadowBindGroup.missingIblSamplerResource` | StandardMaterial light/IBL bind-group planning requires an IBL sampler. | —    | `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group.ts` |

## standardLightShadowBindGroup.missingLayoutKey (1)

| Code                                            | Message                                                                  | Fix? | Emitted from                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------ | ---- | ---------------------------------------------------------------------------- |
| `standardLightShadowBindGroup.missingLayoutKey` | StandardMaterial light/shadow bind-group planning requires a layout key. | —    | `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group.ts` |

## standardLightShadowBindGroup.missingLightGpuBufferResource (1)

| Code                                                         | Message                                                                       | Fix? | Emitted from                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardLightShadowBindGroup.missingLightGpuBufferResource` | StandardMaterial light/shadow bind-group planning requires light GPU buffers. | —    | `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group.ts` |

## standardLightShadowBindGroup.missingMatrixBufferResource (1)

| Code                                                       | Message                                                                                | Fix? | Emitted from                                                                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standardLightShadowBindGroup.missingMatrixBufferResource` | StandardMaterial light/shadow/IBL bind-group planning requires a shadow matrix buffer. | —    | `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group-entries.ts`<br>`packages/webgpu/src/materials/standard/standard-light-shadow-bind-group.ts` |

## standardLightShadowBindGroup.missingSamplerResource (1)

| Code                                                  | Message                                                                                     | Fix? | Emitted from                                                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standardLightShadowBindGroup.missingSamplerResource` | StandardMaterial light/shadow/IBL bind-group planning requires a shadow comparison sampler. | —    | `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group-entries.ts`<br>`packages/webgpu/src/materials/standard/standard-light-shadow-bind-group.ts` |

## standardLightShadowBindGroupResource.creationFailed (1)

| Code                                                  | Message                                                          | Fix? | Emitted from                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardLightShadowBindGroupResource.creationFailed` | Failed to create StandardMaterial light/shadow bind group '…': … | —    | `packages/webgpu/src/materials/standard/standard-light-shadow-bind-group.ts` |

## standardMaterial.invalidColor (1)

| Code                            | Message                                     | Fix? | Emitted from                                            |
| ------------------------------- | ------------------------------------------- | ---- | ------------------------------------------------------- |
| `standardMaterial.invalidColor` | … must contain finite numeric color values. | —    | `packages/render/src/materials/standard-proof-point.ts` |

## standardMaterial.invalidFactor (1)

| Code                             | Message                                                    | Fix? | Emitted from                                            |
| -------------------------------- | ---------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `standardMaterial.invalidFactor` | iridescenceIor must be a finite value between 1 and 2.333. | —    | `packages/render/src/materials/standard-proof-point.ts` |

## standardMaterial.unsupportedFeature (1)

| Code                                  | Message                                                    | Fix? | Emitted from                                            |
| ------------------------------------- | ---------------------------------------------------------- | ---- | ------------------------------------------------------- |
| `standardMaterial.unsupportedFeature` | iridescenceIor must be a finite value between 1 and 2.333. | —    | `packages/render/src/materials/standard-proof-point.ts` |

## standardMaterialBindGroup.missingMaterialResource (1)

| Code                                                | Message                                                                            | Fix? | Emitted from                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `standardMaterialBindGroup.missingMaterialResource` | Standard material bind group planning requires a material uniform buffer resource. | —    | `packages/webgpu/src/materials/standard/standard-bind-group.ts` |

## standardMaterialBindGroup.missingSamplerResource (1)

| Code                                               | Message                                            | Fix? | Emitted from                                                    |
| -------------------------------------------------- | -------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `standardMaterialBindGroup.missingSamplerResource` | … texture binding requires a sampler resource key. | —    | `packages/webgpu/src/materials/standard/standard-bind-group.ts` |

## standardMaterialBindGroup.missingTextureResource (1)

| Code                                               | Message                                            | Fix? | Emitted from                                                    |
| -------------------------------------------------- | -------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `standardMaterialBindGroup.missingTextureResource` | … texture binding requires a texture resource key. | —    | `packages/webgpu/src/materials/standard/standard-bind-group.ts` |

## standardMaterialBindGroupLayout.invalidGroup (1)

| Code                                           | Message                                                              | Fix? | Emitted from                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `standardMaterialBindGroupLayout.invalidGroup` | Standard material resources must use bind group 2; received group …. | —    | `packages/webgpu/src/materials/standard/standard-bind-group-layout.ts` |

## standardMaterialBindGroupLayout.missingBinding (1)

| Code                                             | Message                                                            | Fix? | Emitted from                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------ | ---- | ---------------------------------------------------------------------- |
| `standardMaterialBindGroupLayout.missingBinding` | Standard material bind group layout is missing required binding …. | —    | `packages/webgpu/src/materials/standard/standard-bind-group-layout.ts` |

## standardMaterialBindGroupLayout.resourceKindMismatch (1)

| Code                                                   | Message                                           | Fix? | Emitted from                                                           |
| ------------------------------------------------------ | ------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `standardMaterialBindGroupLayout.resourceKindMismatch` | Standard material binding … must be '…', not '…'. | —    | `packages/webgpu/src/materials/standard/standard-bind-group-layout.ts` |

## standardMaterialBindGroupResource.creationFailed (1)

| Code                                               | Message                                              | Fix? | Emitted from                                                    |
| -------------------------------------------------- | ---------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `standardMaterialBindGroupResource.creationFailed` | Failed to create standard material bind group '…': … | —    | `packages/webgpu/src/materials/standard/standard-bind-group.ts` |

## standardMaterialBindGroupResource.invalidDescriptorPlan (1)

| Code                                                      | Message                                                                       | Fix? | Emitted from                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `standardMaterialBindGroupResource.invalidDescriptorPlan` | Cannot create a standard material bind group from an invalid descriptor plan. | —    | `packages/webgpu/src/materials/standard/standard-bind-group.ts` |

## standardMaterialBindGroupResource.invalidLayout (1)

| Code                                              | Message                                                              | Fix? | Emitted from                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `standardMaterialBindGroupResource.invalidLayout` | Standard material bind group layout resource must be group 2, not …. | —    | `packages/webgpu/src/materials/standard/standard-bind-group.ts` |

## standardMaterialBindGroupResource.missingBufferResource (1)

| Code                                                      | Message                                                        | Fix? | Emitted from                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `standardMaterialBindGroupResource.missingBufferResource` | Missing GPU buffer resource '…' for standard material group 2. | —    | `packages/webgpu/src/materials/standard/standard-bind-group.ts` |

## standardMaterialBindGroupResource.missingDeviceSupport (1)

| Code                                                     | Message                                                    | Fix? | Emitted from                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `standardMaterialBindGroupResource.missingDeviceSupport` | WebGPU device cannot create standard material bind groups. | —    | `packages/webgpu/src/materials/standard/standard-bind-group.ts` |

## standardMaterialBindGroupResource.missingLayout (1)

| Code                                              | Message                                                                   | Fix? | Emitted from                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `standardMaterialBindGroupResource.missingLayout` | Standard material bind group creation requires a group-2 layout resource. | —    | `packages/webgpu/src/materials/standard/standard-bind-group.ts` |

## standardMaterialBindGroupResource.missingSamplerResource (1)

| Code                                                       | Message                                                         | Fix? | Emitted from                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `standardMaterialBindGroupResource.missingSamplerResource` | Missing GPU sampler resource '…' for standard material group 2. | —    | `packages/webgpu/src/materials/standard/standard-bind-group.ts` |

## standardMaterialBindGroupResource.missingTextureResource (1)

| Code                                                       | Message                                                              | Fix? | Emitted from                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `standardMaterialBindGroupResource.missingTextureResource` | Missing GPU texture view resource '…' for standard material group 2. | —    | `packages/webgpu/src/materials/standard/standard-bind-group.ts` |

## standardMaterialBindGroupResource.nullDescriptorPlan (1)

| Code                                                   | Message                                                                   | Fix? | Emitted from                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------- | ---- | --------------------------------------------------------------- |
| `standardMaterialBindGroupResource.nullDescriptorPlan` | Cannot create a standard material bind group from a null descriptor plan. | —    | `packages/webgpu/src/materials/standard/standard-bind-group.ts` |

## standardMaterialBuffer.invalidUniformData (1)

| Code                                        | Message                                                                        | Fix? | Emitted from                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------- |
| `standardMaterialBuffer.invalidUniformData` | Packed standard material uniform data must match the documented …-byte layout. | —    | `packages/webgpu/src/materials/standard/standard-material-buffer.ts` |

## standardMaterialBuffer.invalidUsageFlags (1)

| Code                                       | Message                                                                  | Fix? | Emitted from                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------- |
| `standardMaterialBuffer.invalidUsageFlags` | Standard material uniform buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/materials/standard/standard-material-buffer.ts` |

## standardMaterialBuffer.nullPackedMaterial (1)

| Code                                        | Message                                                                             | Fix? | Emitted from                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `standardMaterialBuffer.nullPackedMaterial` | Cannot create a standard material buffer descriptor from null packed material data. | —    | `packages/webgpu/src/materials/standard/standard-material-buffer.ts` |

## standardMaterialGpuBuffer.creationFailed (1)

| Code                                       | Message                                                  | Fix? | Emitted from                                                                  |
| ------------------------------------------ | -------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `standardMaterialGpuBuffer.creationFailed` | Failed to create standard material uniform buffer '…': … | —    | `packages/webgpu/src/materials/standard/standard-material-buffer-resource.ts` |

## standardMaterialGpuBuffer.nullDescriptorPlan (1)

| Code                                           | Message                                                                   | Fix? | Emitted from                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| `standardMaterialGpuBuffer.nullDescriptorPlan` | Cannot create a standard material GPU buffer from a null descriptor plan. | —    | `packages/webgpu/src/materials/standard/standard-material-buffer-resource.ts` |

## standardMaterialIbl.missingDescriptors (1)

| Code                                     | Message                                                                                      | Fix? | Emitted from                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------- |
| `standardMaterialIbl.missingDescriptors` | StandardMaterial IBL requires renderer-owned IBL descriptors for extracted environment maps. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-readiness.ts` |

## standardMaterialIbl.shaderSamplingDeferred (1)

| Code                                         | Message                                                                                                  | Fix? | Emitted from                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------- |
| `standardMaterialIbl.shaderSamplingDeferred` | StandardMaterial IBL descriptors are reported for readiness, but shader sampling is not implemented yet. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-readiness.ts` |

## standardMaterialIbl.unsupportedSlots (1)

| Code                                   | Message                                                                                                                  | Fix? | Emitted from                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------------- |
| `standardMaterialIbl.unsupportedSlots` | StandardMaterial IBL has descriptors, but at least one diffuse or specular IBL slot is still an unsupported placeholder. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-readiness.ts` |

## standardMaterialIblBindGroup.invalidLayout (1)

| Code                                         | Message                                                                                     | Fix? | Emitted from                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardMaterialIblBindGroup.invalidLayout` | StandardMaterial IBL bind-group descriptor planning requires valid group 4 layout metadata. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group.ts` |

## standardMaterialIblBindGroup.missingDiffuseTextureResource (1)

| Code                                                         | Message                                                                                                        | Fix? | Emitted from                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardMaterialIblBindGroup.missingDiffuseTextureResource` | StandardMaterial IBL bind-group descriptor planning requires an available diffuse irradiance texture resource. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group.ts` |

## standardMaterialIblBindGroup.missingSamplerResource (1)

| Code                                                  | Message                                                                                         | Fix? | Emitted from                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardMaterialIblBindGroup.missingSamplerResource` | StandardMaterial IBL bind-group descriptor planning requires an available IBL sampler resource. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group.ts` |

## standardMaterialIblBindGroup.shaderSamplingDeferred (1)

| Code                                                  | Message                                                                                            | Fix? | Emitted from                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardMaterialIblBindGroup.shaderSamplingDeferred` | StandardMaterial IBL bind-group descriptor keys are planned, but WGSL shader sampling is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group.ts` |

## standardMaterialIblBindGroup.specularTextureResourceDeferred (1)

| Code                                                           | Message                                                                                                                                     | Fix? | Emitted from                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardMaterialIblBindGroup.specularTextureResourceDeferred` | StandardMaterial IBL bind-group descriptor planning requires a renderer-owned specular prefilter texture resource, which is still deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group.ts` |

## standardMaterialIblBindGroupLayout.bindGroupResourceDeferred (1)

| Code                                                           | Message                                                                                                   | Fix? | Emitted from                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------- |
| `standardMaterialIblBindGroupLayout.bindGroupResourceDeferred` | StandardMaterial IBL bind-group layout metadata is planned, but bind group resource creation is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group-layout.ts` |

## standardMaterialIblBindGroupLayout.invalidGroup (1)

| Code                                              | Message                                                                  | Fix? | Emitted from                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------- |
| `standardMaterialIblBindGroupLayout.invalidGroup` | Standard material IBL resources must use bind group 4; received group …. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group-layout.ts` |

## standardMaterialIblBindGroupLayout.invalidLayout (1)

| Code                                               | Message                                                     | Fix? | Emitted from                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------- |
| `standardMaterialIblBindGroupLayout.invalidLayout` | StandardMaterial IBL bind-group layout metadata is invalid. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group-layout.ts` |

## standardMaterialIblBindGroupLayout.missingBinding (1)

| Code                                                | Message                                                                | Fix? | Emitted from                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------- |
| `standardMaterialIblBindGroupLayout.missingBinding` | Standard material IBL bind group layout is missing required binding …. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group-layout.ts` |

## standardMaterialIblBindGroupLayout.resourceKindMismatch (1)

| Code                                                      | Message                                               | Fix? | Emitted from                                                                        |
| --------------------------------------------------------- | ----------------------------------------------------- | ---- | ----------------------------------------------------------------------------------- |
| `standardMaterialIblBindGroupLayout.resourceKindMismatch` | Standard material IBL binding … must be '…', not '…'. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group-layout.ts` |

## standardMaterialIblBindGroupLayout.shaderSamplingDeferred (1)

| Code                                                        | Message                                                                                           | Fix? | Emitted from                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------- |
| `standardMaterialIblBindGroupLayout.shaderSamplingDeferred` | StandardMaterial IBL bind-group layout metadata is planned, but WGSL shader sampling is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group-layout.ts` |

## standardMaterialIblBindGroupResource.creationFailed (1)

| Code                                                  | Message                                                 | Fix? | Emitted from                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardMaterialIblBindGroupResource.creationFailed` | Failed to create StandardMaterial IBL bind group '…': … | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group.ts` |

## standardMaterialIblBindGroupResource.invalidDescriptorPlan (1)

| Code                                                         | Message                                                                    | Fix? | Emitted from                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardMaterialIblBindGroupResource.invalidDescriptorPlan` | StandardMaterial IBL bind-group creation requires a valid descriptor plan. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group.ts` |

## standardMaterialIblBindGroupResource.invalidLayout (1)

| Code                                                 | Message                                                              | Fix? | Emitted from                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardMaterialIblBindGroupResource.invalidLayout` | WebGPU device cannot create StandardMaterial IBL bind group layouts. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group.ts` |

## standardMaterialIblBindGroupResource.missingDeviceSupport (1)

| Code                                                        | Message                                                              | Fix? | Emitted from                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardMaterialIblBindGroupResource.missingDeviceSupport` | WebGPU device cannot create StandardMaterial IBL bind group layouts. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group.ts` |

## standardMaterialIblBindGroupResource.nullDescriptorPlan (1)

| Code                                                      | Message                                                              | Fix? | Emitted from                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardMaterialIblBindGroupResource.nullDescriptorPlan` | StandardMaterial IBL bind-group creation requires a descriptor plan. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group.ts` |

## standardMaterialIblBindGroupResource.shaderSamplingDeferred (1)

| Code                                                          | Message                                                                                   | Fix? | Emitted from                                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `standardMaterialIblBindGroupResource.shaderSamplingDeferred` | StandardMaterial IBL bind-group resources are live, but WGSL shader sampling is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-bind-group.ts` |

## standardMaterialIblShadowBinding.bindGroupDeferred (1)

| Code                                                 | Message                                                                                            | Fix? | Emitted from                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------ |
| `standardMaterialIblShadowBinding.bindGroupDeferred` | StandardMaterial IBL/shadow binding slots are planned, but bind group layout changes are deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-shadow-binding-readiness.ts` |

## standardMaterialIblShadowBinding.missingIblPlan (1)

| Code                                              | Message                                                                        | Fix? | Emitted from                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------ |
| `standardMaterialIblShadowBinding.missingIblPlan` | StandardMaterial IBL binding readiness requires IBL preparation pass planning. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-shadow-binding-readiness.ts` |

## standardMaterialIblShadowBinding.missingShadowPlan (1)

| Code                                                 | Message                                                                                         | Fix? | Emitted from                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------ |
| `standardMaterialIblShadowBinding.missingShadowPlan` | StandardMaterial shadow binding readiness requires shadow matrix and caster draw-list planning. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-shadow-binding-readiness.ts` |

## standardMaterialIblShadowBinding.shaderSamplingDeferred (1)

| Code                                                      | Message                                                                                 | Fix? | Emitted from                                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------ |
| `standardMaterialIblShadowBinding.shaderSamplingDeferred` | StandardMaterial IBL/shadow binding slots are planned, but shader sampling is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-shadow-binding-readiness.ts` |

## standardMaterialIblShadowPipelineKey.deferredFeature (1)

| Code                                                   | Message                                                                                                                          | Fix? | Emitted from                                                                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| `standardMaterialIblShadowPipelineKey.deferredFeature` | StandardMaterial IBL/shadow pipeline-key metadata is planned, but WGSL, bind-group layouts, and shader sampling remain deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-shadow-pipeline-key-readiness.ts` |

## standardMaterialIblShadowPipelineKey.missingBindingReadiness (1)

| Code                                                           | Message                                                                                 | Fix? | Emitted from                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| `standardMaterialIblShadowPipelineKey.missingBindingReadiness` | StandardMaterial IBL/shadow pipeline-key readiness requires binding readiness metadata. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-shadow-pipeline-key-readiness.ts` |

## standardMaterialIblShadowPipelineKey.shaderSamplingDeferred (1)

| Code                                                          | Message                                                                                                                          | Fix? | Emitted from                                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| `standardMaterialIblShadowPipelineKey.shaderSamplingDeferred` | StandardMaterial IBL/shadow pipeline-key metadata is planned, but WGSL, bind-group layouts, and shader sampling remain deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-ibl-shadow-pipeline-key-readiness.ts` |

## standardMaterialPack.missingSamplerHandle (1)

| Code                                        | Message                        | Fix? | Emitted from                                                         |
| ------------------------------------------- | ------------------------------ | ---- | -------------------------------------------------------------------- |
| `standardMaterialPack.missingSamplerHandle` | … is missing a sampler handle. | —    | `packages/webgpu/src/materials/standard/standard-material-buffer.ts` |

## standardMaterialPack.missingTextureHandle (1)

| Code                                        | Message                        | Fix? | Emitted from                                                         |
| ------------------------------------------- | ------------------------------ | ---- | -------------------------------------------------------------------- |
| `standardMaterialPack.missingTextureHandle` | … is missing a texture handle. | —    | `packages/webgpu/src/materials/standard/standard-material-buffer.ts` |

## standardMaterialPack.unsupportedMaterialKind (1)

| Code                                           | Message                                                   | Fix? | Emitted from                                                         |
| ---------------------------------------------- | --------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `standardMaterialPack.unsupportedMaterialKind` | Standard material packing does not support '…' materials. | —    | `packages/webgpu/src/materials/standard/standard-material-buffer.ts` |

## standardMaterialRenderState.alphaModeMismatch (1)

| Code                                            | Message                                                                   | Fix? | Emitted from                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `standardMaterialRenderState.alphaModeMismatch` | StandardMaterial pipeline alpha token does not match source render state. | —    | `packages/webgpu/src/materials/standard/standard-render-state-summary.ts` |

## standardMaterialRenderState.blendPresetMismatch (1)

| Code                                              | Message                                                                   | Fix? | Emitted from                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `standardMaterialRenderState.blendPresetMismatch` | StandardMaterial pipeline blend token does not match source render state. | —    | `packages/webgpu/src/materials/standard/standard-render-state-summary.ts` |

## standardMaterialRenderState.cullModeMismatch (1)

| Code                                           | Message                                                                  | Fix? | Emitted from                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------- |
| `standardMaterialRenderState.cullModeMismatch` | StandardMaterial pipeline cull token does not match source render state. | —    | `packages/webgpu/src/materials/standard/standard-render-state-summary.ts` |

## standardMaterialRenderState.depthWriteMismatch (1)

| Code                                             | Message                                                                                        | Fix? | Emitted from                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `standardMaterialRenderState.depthWriteMismatch` | StandardMaterial source depth-write state does not match WebGPU pipeline depth-write behavior. | —    | `packages/webgpu/src/materials/standard/standard-render-state-summary.ts` |

## standardMaterialRenderState.renderPhaseMismatch (1)

| Code                                              | Message                                                              | Fix? | Emitted from                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `standardMaterialRenderState.renderPhaseMismatch` | StandardMaterial source alpha mode expects '…' queue phase, not '…'. | —    | `packages/webgpu/src/materials/standard/standard-render-state-summary.ts` |

## standardMaterialRenderState.validation (1)

| Code                                     | Message                                                                   | Fix? | Emitted from                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `standardMaterialRenderState.validation` | StandardMaterial pipeline alpha token does not match source render state. | —    | `packages/webgpu/src/materials/standard/standard-render-state-summary.ts` |

## standardMaterialSampler.anisotropyNotReported (1)

| Code                                            | Message                                                                                                                                        | Fix? | Emitted from                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `standardMaterialSampler.anisotropyNotReported` | StandardMaterial … sampler '…' authors maxAnisotropy …, but current StandardMaterial diagnostics do not report anisotropic sampling readiness. | —    | `packages/render/src/materials/standard-sampler-fidelity-inspection.ts` |

## standardMaterialSampler.lodMaxExceedsMipRange (1)

| Code                                            | Message                                                                                      | Fix? | Emitted from                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `standardMaterialSampler.lodMaxExceedsMipRange` | StandardMaterial … sampler '…' uses lodMaxClamp …, but texture '…' supports LOD 0 through …. | —    | `packages/render/src/materials/standard-sampler-fidelity-inspection.ts` |

## standardMaterialSampler.materialNotReady (1)

| Code                                       | Message                                                                       | Fix? | Emitted from                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `standardMaterialSampler.materialNotReady` | StandardMaterial sampler fidelity requires material '…' to be ready, not '…'. | —    | `packages/render/src/materials/standard-sampler-fidelity.ts` |

## standardMaterialSampler.mipmapFilterWithoutMips (1)

| Code                                              | Message                                                                                          | Fix? | Emitted from                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------- |
| `standardMaterialSampler.mipmapFilterWithoutMips` | StandardMaterial … sampler '…' requests '…' mip filtering, but texture '…' has only … mip level. | —    | `packages/render/src/materials/standard-sampler-fidelity-inspection.ts` |

## standardMaterialSampler.missingMaterial (1)

| Code                                      | Message                                                             | Fix? | Emitted from                                                 |
| ----------------------------------------- | ------------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `standardMaterialSampler.missingMaterial` | StandardMaterial sampler fidelity requires registered material '…'. | —    | `packages/render/src/materials/standard-sampler-fidelity.ts` |

## standardMaterialSampler.samplerNotReady (1)

| Code                                      | Message                                                                        | Fix? | Emitted from                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------- |
| `standardMaterialSampler.samplerNotReady` | StandardMaterial … sampler fidelity requires sampler '…' to be ready, not '…'. | —    | `packages/render/src/materials/standard-sampler-fidelity-inspection.ts` |

## standardMaterialSampler.textureNotReady (1)

| Code                                      | Message                                                                        | Fix? | Emitted from                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------- |
| `standardMaterialSampler.textureNotReady` | StandardMaterial … sampler fidelity requires texture '…' to be ready, not '…'. | —    | `packages/render/src/materials/standard-sampler-fidelity-inspection.ts` |

## standardMaterialSampler.unsupportedMaterialKind (1)

| Code                                              | Message                                                                 | Fix? | Emitted from                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `standardMaterialSampler.unsupportedMaterialKind` | StandardMaterial sampler fidelity requires a StandardMaterial, not '…'. | —    | `packages/render/src/materials/standard-sampler-fidelity.ts` |

## standardMaterialShadow.missingPassPlan (1)

| Code                                     | Message                                                                                  | Fix? | Emitted from                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `standardMaterialShadow.missingPassPlan` | StandardMaterial shadows require renderer-owned shadow texture resources and pass plans. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-readiness.ts` |

## standardMaterialShadow.passSubmissionDeferred (1)

| Code                                            | Message                                                                                   | Fix? | Emitted from                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `standardMaterialShadow.passSubmissionDeferred` | StandardMaterial shadows have pass planning data, but shadow pass submission is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-readiness.ts` |

## standardMaterialShadow.shaderSamplingDeferred (1)

| Code                                            | Message                                                                                                             | Fix? | Emitted from                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `standardMaterialShadow.shaderSamplingDeferred` | StandardMaterial shadow pass planning is reported for readiness, but shader shadow sampling is not implemented yet. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-readiness.ts` |

## standardMaterialShadow.unsupportedPassSubmission (1)

| Code                                               | Message                                                                                      | Fix? | Emitted from                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------ |
| `standardMaterialShadow.unsupportedPassSubmission` | StandardMaterial shadows have pass planning data, but shadow pass submission is unsupported. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-readiness.ts` |

## standardMaterialShadowBindGroup.bindGroupCreationDeferred (1)

| Code                                                        | Message                                                                                                   | Fix? | Emitted from                                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroup.bindGroupCreationDeferred` | StandardMaterial shadow bind-group descriptor keys are planned, but live bind-group creation is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroup.invalidLayout (1)

| Code                                            | Message                                                                                        | Fix? | Emitted from                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroup.invalidLayout` | StandardMaterial shadow bind-group descriptor planning requires valid group 5 layout metadata. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroup.missingDepthTextureResource (1)

| Code                                                          | Message                                                                                                     | Fix? | Emitted from                                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroup.missingDepthTextureResource` | StandardMaterial shadow bind-group descriptor planning requires an available shadow depth texture resource. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroup.missingMatrixBufferResource (1)

| Code                                                          | Message                                                                                                     | Fix? | Emitted from                                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroup.missingMatrixBufferResource` | StandardMaterial shadow bind-group descriptor planning requires an available shadow matrix buffer resource. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroup.missingSamplerResource (1)

| Code                                                     | Message                                                                                               | Fix? | Emitted from                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroup.missingSamplerResource` | StandardMaterial shadow bind-group descriptor planning requires an available shadow sampler resource. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroup.samplerResourceDeferred (1)

| Code                                                      | Message                                                                                                            | Fix? | Emitted from                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroup.samplerResourceDeferred` | StandardMaterial shadow bind-group descriptor planning requires a live shadow sampler resource, which is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroup.shaderSamplingDeferred (1)

| Code                                                     | Message                                                                                               | Fix? | Emitted from                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroup.shaderSamplingDeferred` | StandardMaterial shadow bind-group descriptor keys are planned, but WGSL shadow sampling is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroup.unsupportedDepthTextureView (1)

| Code                                                          | Message                                                                                                                                      | Fix? | Emitted from                                                                    |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroup.unsupportedDepthTextureView` | StandardMaterial shadow bind-group descriptor planning supports one 2D directional shadow map or a 2D-array cascaded directional shadow map. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroupLayout.bindGroupResourceDeferred (1)

| Code                                                              | Message                                                                                                      | Fix? | Emitted from                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---- | -------------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupLayout.bindGroupResourceDeferred` | StandardMaterial shadow bind-group layout metadata is planned, but bind group resource creation is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group-layout.ts` |

## standardMaterialShadowBindGroupLayout.invalidGroup (1)

| Code                                                 | Message                                                                     | Fix? | Emitted from                                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupLayout.invalidGroup` | Standard material shadow resources must use bind group 5; received group …. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group-layout.ts` |

## standardMaterialShadowBindGroupLayout.invalidLayout (1)

| Code                                                  | Message                                                        | Fix? | Emitted from                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupLayout.invalidLayout` | StandardMaterial shadow bind-group layout metadata is invalid. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group-layout.ts` |

## standardMaterialShadowBindGroupLayout.missingBinding (1)

| Code                                                   | Message                                                                   | Fix? | Emitted from                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupLayout.missingBinding` | Standard material shadow bind group layout is missing required binding …. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group-layout.ts` |

## standardMaterialShadowBindGroupLayout.resourceKindMismatch (1)

| Code                                                         | Message                                                  | Fix? | Emitted from                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupLayout.resourceKindMismatch` | Standard material shadow binding … must be '…', not '…'. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group-layout.ts` |

## standardMaterialShadowBindGroupLayout.shaderSamplingDeferred (1)

| Code                                                           | Message                                                                                              | Fix? | Emitted from                                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupLayout.shaderSamplingDeferred` | StandardMaterial shadow bind-group layout metadata is planned, but WGSL shader sampling is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group-layout.ts` |

## standardMaterialShadowBindGroupResource.creationFailed (1)

| Code                                                     | Message                                                    | Fix? | Emitted from                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupResource.creationFailed` | Failed to create StandardMaterial shadow bind group '…': … | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroupResource.invalidDescriptorPlan (1)

| Code                                                            | Message                                                                       | Fix? | Emitted from                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupResource.invalidDescriptorPlan` | StandardMaterial shadow bind-group creation requires a valid descriptor plan. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroupResource.invalidLayout (1)

| Code                                                    | Message                                                                 | Fix? | Emitted from                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupResource.invalidLayout` | WebGPU device cannot create StandardMaterial shadow bind group layouts. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroupResource.missingBufferResource (1)

| Code                                                            | Message                                                            | Fix? | Emitted from                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupResource.missingBufferResource` | Missing StandardMaterial shadow buffer resource '…' for binding …. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroupResource.missingDeviceSupport (1)

| Code                                                           | Message                                                                 | Fix? | Emitted from                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupResource.missingDeviceSupport` | WebGPU device cannot create StandardMaterial shadow bind group layouts. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroupResource.missingSamplerResource (1)

| Code                                                             | Message                                                             | Fix? | Emitted from                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupResource.missingSamplerResource` | Missing StandardMaterial shadow sampler resource '…' for binding …. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroupResource.missingTextureResource (1)

| Code                                                             | Message                                                                  | Fix? | Emitted from                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupResource.missingTextureResource` | Missing StandardMaterial shadow texture view resource '…' for binding …. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroupResource.nullDescriptorPlan (1)

| Code                                                         | Message                                                                 | Fix? | Emitted from                                                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupResource.nullDescriptorPlan` | StandardMaterial shadow bind-group creation requires a descriptor plan. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroupResource.passSubmissionDeferred (1)

| Code                                                             | Message                                                                                        | Fix? | Emitted from                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupResource.passSubmissionDeferred` | StandardMaterial shadow bind-group resources are live, but shadow pass submission is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowBindGroupResource.shaderSamplingDeferred (1)

| Code                                                             | Message                                                                                      | Fix? | Emitted from                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `standardMaterialShadowBindGroupResource.shaderSamplingDeferred` | StandardMaterial shadow bind-group resources are live, but WGSL shadow sampling is deferred. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-bind-group.ts` |

## standardMaterialShadowReceiverBinding.commandBufferNotReady (1)

| Code                                                          | Message                                                                                          | Fix? | Emitted from                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------------------- |
| `standardMaterialShadowReceiverBinding.commandBufferNotReady` | StandardMaterial shadow receiver binding requires a finished or submitted shadow command buffer. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-receiver-binding-readiness.ts` |

## standardMaterialShadowReceiverBinding.missingBindGroupResource (1)

| Code                                                             | Message                                                                               | Fix? | Emitted from                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| `standardMaterialShadowReceiverBinding.missingBindGroupResource` | StandardMaterial shadow receiver binding requires a live group 5 bind group resource. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-receiver-binding-readiness.ts` |

## standardMaterialShadowReceiverBinding.missingDepthTextureResource (1)

| Code                                                                | Message                                                                             | Fix? | Emitted from                                                                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| `standardMaterialShadowReceiverBinding.missingDepthTextureResource` | StandardMaterial shadow receiver binding requires a live shadow depth texture view. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-receiver-binding-readiness.ts` |

## standardMaterialShadowReceiverBinding.missingMatrixBufferResource (1)

| Code                                                                | Message                                                                                 | Fix? | Emitted from                                                                                    |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| `standardMaterialShadowReceiverBinding.missingMatrixBufferResource` | StandardMaterial shadow receiver binding requires a live shadow matrix buffer resource. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-receiver-binding-readiness.ts` |

## standardMaterialShadowReceiverBinding.missingSamplerResource (1)

| Code                                                           | Message                                                                           | Fix? | Emitted from                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| `standardMaterialShadowReceiverBinding.missingSamplerResource` | StandardMaterial shadow receiver binding requires a live shadow sampler resource. | —    | `packages/webgpu/src/materials/standard/standard-material-shadow-receiver-binding-readiness.ts` |

## standardMaterialTexture.invalidColorSpace (1)

| Code                                        | Message                                                             | Fix? | Emitted from                                                          |
| ------------------------------------------- | ------------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `standardMaterialTexture.invalidColorSpace` | StandardMaterial … texture '…' should use color space '…', not '…'. | —    | `packages/render/src/materials/standard-texture-readiness-texture.ts` |

## standardMaterialTexture.invalidColorSpaceFormat (1)

| Code                                              | Message                                                                              | Fix? | Emitted from                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------- |
| `standardMaterialTexture.invalidColorSpaceFormat` | StandardMaterial … texture '…' declares color space '…' but uses texture format '…'. | —    | `packages/render/src/materials/standard-texture-readiness-texture.ts` |

## standardMaterialTexture.invalidSemantic (1)

| Code                                      | Message                                                          | Fix? | Emitted from                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `standardMaterialTexture.invalidSemantic` | StandardMaterial … texture '…' should use semantic '…', not '…'. | —    | `packages/render/src/materials/standard-texture-readiness-texture.ts` |

## standardMaterialTexture.materialNotReady (1)

| Code                                       | Message                                                                        | Fix? | Emitted from                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------- |
| `standardMaterialTexture.materialNotReady` | StandardMaterial texture readiness requires material '…' to be ready, not '…'. | —    | `packages/render/src/materials/standard-texture-readiness.ts` |

## standardMaterialTexture.missingMaterial (1)

| Code                                      | Message                                                              | Fix? | Emitted from                                                  |
| ----------------------------------------- | -------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `standardMaterialTexture.missingMaterial` | StandardMaterial texture readiness requires registered material '…'. | —    | `packages/render/src/materials/standard-texture-readiness.ts` |

## standardMaterialTexture.missingSamplerHandle (1)

| Code                                           | Message                                         | Fix? | Emitted from                                                             |
| ---------------------------------------------- | ----------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `standardMaterialTexture.missingSamplerHandle` | StandardMaterial … is missing a sampler handle. | —    | `packages/render/src/materials/standard-texture-readiness-inspection.ts` |

## standardMaterialTexture.missingTextureHandle (1)

| Code                                           | Message                                         | Fix? | Emitted from                                                             |
| ---------------------------------------------- | ----------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `standardMaterialTexture.missingTextureHandle` | StandardMaterial … is missing a texture handle. | —    | `packages/render/src/materials/standard-texture-readiness-inspection.ts` |

## standardMaterialTexture.samplerNotReady (1)

| Code                                      | Message                                           | Fix? | Emitted from                                                             |
| ----------------------------------------- | ------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `standardMaterialTexture.samplerNotReady` | StandardMaterial … sampler '…' is '…', not ready. | —    | `packages/render/src/materials/standard-texture-readiness-inspection.ts` |

## standardMaterialTexture.textureNotReady (1)

| Code                                      | Message                                           | Fix? | Emitted from                                                             |
| ----------------------------------------- | ------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `standardMaterialTexture.textureNotReady` | StandardMaterial … texture '…' is '…', not ready. | —    | `packages/render/src/materials/standard-texture-readiness-inspection.ts` |

## standardMaterialTexture.unsupportedMaterialKind (1)

| Code                                              | Message                                                                  | Fix? | Emitted from                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ---- | ------------------------------------------------------------- |
| `standardMaterialTexture.unsupportedMaterialKind` | StandardMaterial texture readiness requires a StandardMaterial, not '…'. | —    | `packages/render/src/materials/standard-texture-readiness.ts` |

## standardMaterialTexture.unsupportedTexCoord (1)

| Code                                          | Message                                                                                                | Fix? | Emitted from                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------- |
| `standardMaterialTexture.unsupportedTexCoord` | StandardMaterial … uses unsupported texCoord …; only TEXCOORD_0 and TEXCOORD_1 are currently rendered. | —    | `packages/render/src/materials/standard-texture-readiness-texture.ts` |

## standardMaterialTexture.unsupportedTextureTransform (1)

| Code                                                  | Message                                                                                                | Fix? | Emitted from                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------ |
| `standardMaterialTexture.unsupportedTextureTransform` | StandardMaterial … uses a texture transform that is not supported by current StandardMaterial shaders. | —    | `packages/render/src/materials/standard-texture-readiness-inspection.ts` |

## standardNormalMap.missingTangents (1)

| Code                                | Message                                                                                                                | Fix? | Emitted from                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `standardNormalMap.missingTangents` | StandardMaterial normalTexture requires mesh TANGENT vertex attributes before tangent-space normal mapping can render. | —    | `packages/render/src/materials/standard-normal-map-readiness.ts` |

## standardNormalMap.unsupportedMaterialKind (1)

| Code                                        | Message                                                                     | Fix? | Emitted from                                                     |
| ------------------------------------------- | --------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| `standardNormalMap.unsupportedMaterialKind` | Standard normal-map tangent readiness requires a StandardMaterial, not '…'. | —    | `packages/render/src/materials/standard-normal-map-readiness.ts` |

## standardPipeline.deferredFeature (1)

| Code                               | Message                                                         | Fix? | Emitted from                                                             |
| ---------------------------------- | --------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `standardPipeline.deferredFeature` | … is deferred for the direct-lit StandardMaterial MVP pipeline. | —    | `packages/webgpu/src/materials/standard/standard-pipeline-descriptor.ts` |

## standardPipeline.missingBatchKeyField (1)

| Code                                    | Message                                                     | Fix? | Emitted from                                                             |
| --------------------------------------- | ----------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `standardPipeline.missingBatchKeyField` | Standard pipeline descriptor planning requires a batch key. | —    | `packages/webgpu/src/materials/standard/standard-pipeline-descriptor.ts` |

## standardPipeline.missingColorFormat (1)

| Code                                  | Message                                                        | Fix? | Emitted from                                                             |
| ------------------------------------- | -------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `standardPipeline.missingColorFormat` | Standard pipeline descriptor planning requires a color format. | —    | `packages/webgpu/src/materials/standard/standard-pipeline-descriptor.ts` |

## standardPipeline.missingShaderMetadata (1)

| Code                                     | Message                                                        | Fix? | Emitted from                                                             |
| ---------------------------------------- | -------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `standardPipeline.missingShaderMetadata` | Standard pipeline descriptor planning requires a color format. | —    | `packages/webgpu/src/materials/standard/standard-pipeline-descriptor.ts` |

## standardPipeline.unsupportedShaderFamily (1)

| Code                                       | Message                                                                                     | Fix? | Emitted from                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `standardPipeline.unsupportedShaderFamily` | Standard pipeline descriptor planning requires a 'standard' material pipeline key, not '…'. | —    | `packages/webgpu/src/materials/standard/standard-pipeline-descriptor.ts` |

## standardPipeline.unsupportedTopology (1)

| Code                                   | Message                                                                 | Fix? | Emitted from                                                             |
| -------------------------------------- | ----------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `standardPipeline.unsupportedTopology` | StandardMaterial MVP pipeline supports triangle-list topology, not '…'. | —    | `packages/webgpu/src/materials/standard/standard-pipeline-descriptor.ts` |

## standardRenderPipeline.createRenderPipelineUnavailable (1)

| Code                                                     | Message                                                  | Fix? | Emitted from                                                  |
| -------------------------------------------------------- | -------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `standardRenderPipeline.createRenderPipelineUnavailable` | WebGPU device cannot create standard material pipelines. | —    | `packages/webgpu/src/materials/standard/standard-pipeline.ts` |

## standardRenderPipeline.descriptorPlanFailed (1)

| Code                                          | Message                       | Fix? | Emitted from                                                  |
| --------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------------- |
| `standardRenderPipeline.descriptorPlanFailed` | (message composed at runtime) | —    | `packages/webgpu/src/materials/standard/standard-pipeline.ts` |

## standardRenderPipeline.pipelineCreationFailed (1)

| Code                                            | Message                       | Fix? | Emitted from                                                  |
| ----------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------------- |
| `standardRenderPipeline.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/materials/standard/standard-pipeline.ts` |

## standardRenderPipeline.shaderCreationFailed (1)

| Code                                          | Message                                                  | Fix? | Emitted from                                                  |
| --------------------------------------------- | -------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `standardRenderPipeline.shaderCreationFailed` | WebGPU device cannot create standard material pipelines. | —    | `packages/webgpu/src/materials/standard/standard-pipeline.ts` |

## standardRenderPipeline.shaderDiagnostic (1)

| Code                                      | Message                       | Fix? | Emitted from                                                  |
| ----------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------------- |
| `standardRenderPipeline.shaderDiagnostic` | (message composed at runtime) | —    | `packages/webgpu/src/materials/standard/standard-pipeline.ts` |

## textureResource.generateMipmapsUnavailable (1)

| Code                                         | Message                                                                     | Fix? | Emitted from                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `textureResource.generateMipmapsUnavailable` | Texture resource '…' requests generated mipmaps for unsupported format '…'. | —    | `packages/webgpu/src/resources/textures/texture-resources.ts` |

## textureResource.invalidBytesPerRow (1)

| Code                                 | Message                                                                                        | Fix? | Emitted from                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `textureResource.invalidBytesPerRow` | Texture upload rowsPerImage for resource '…' mip level … must be an integer at least … row(s). | —    | `packages/webgpu/src/resources/textures/texture-resources.ts` |

## textureResource.invalidColorSpaceFormat (1)

| Code                                      | Message                                                                    | Fix? | Emitted from                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `textureResource.invalidColorSpaceFormat` | Texture resource '…' declares color space '…' but uses texture format '…'. | —    | `packages/webgpu/src/resources/textures/texture-resources.ts` |

## textureResource.invalidMipLevelCount (1)

| Code                                   | Message                                                                                | Fix? | Emitted from                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `textureResource.invalidMipLevelCount` | Texture upload for resource '…' provides … mip level(s), but the descriptor expects …. | —    | `packages/webgpu/src/resources/textures/texture-resources.ts` |

## textureResource.invalidRowsPerImage (1)

| Code                                  | Message                                                                                        | Fix? | Emitted from                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `textureResource.invalidRowsPerImage` | Texture upload rowsPerImage for resource '…' mip level … must be an integer at least … row(s). | —    | `packages/webgpu/src/resources/textures/texture-resources.ts` |

## textureResource.uploadDataTooSmall (1)

| Code                                 | Message                                                                                       | Fix? | Emitted from                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| `textureResource.uploadDataTooSmall` | Texture upload data for resource '…' mip level … must contain at least … byte(s); received …. | —    | `packages/webgpu/src/resources/textures/texture-resources.ts` |

## uiFrame.createBindGroupUnavailable (1)

| Code                                 | Message                                     | Fix? | Emitted from                    |
| ------------------------------------ | ------------------------------------------- | ---- | ------------------------------- |
| `uiFrame.createBindGroupUnavailable` | WebGPU device cannot create UI bind groups. | —    | `packages/webgpu/src/app/ui.ts` |

## uiFrame.imageMissingPipelineLayouts (1)

| Code                                  | Message                                               | Fix? | Emitted from                    |
| ------------------------------------- | ----------------------------------------------------- | ---- | ------------------------------- |
| `uiFrame.imageMissingPipelineLayouts` | UI image pipeline does not expose bind group layouts. | —    | `packages/webgpu/src/app/ui.ts` |

## uiFrame.imageMissingTexture (1)

| Code                          | Message                                        | Fix? | Emitted from                    |
| ----------------------------- | ---------------------------------------------- | ---- | ------------------------------- |
| `uiFrame.imageMissingTexture` | UI image node … is missing its texture handle. | —    | `packages/webgpu/src/app/ui.ts` |

## uiFrame.noRenderableCommands (1)

| Code                           | Message                                                                      | Fix? | Emitted from                    |
| ------------------------------ | ---------------------------------------------------------------------------- | ---- | ------------------------------- |
| `uiFrame.noRenderableCommands` | UI frame preparation found renderable UI nodes but emitted no draw commands. | —    | `packages/webgpu/src/app/ui.ts` |

## uiFrame.panelMissingPipelineLayouts (1)

| Code                                  | Message                                               | Fix? | Emitted from                    |
| ------------------------------------- | ----------------------------------------------------- | ---- | ------------------------------- |
| `uiFrame.panelMissingPipelineLayouts` | UI panel pipeline does not expose bind group layouts. | —    | `packages/webgpu/src/app/ui.ts` |

## uiFrame.textFontAtlasNotReady (1)

| Code                            | Message                                                   | Fix? | Emitted from                    |
| ------------------------------- | --------------------------------------------------------- | ---- | ------------------------------- |
| `uiFrame.textFontAtlasNotReady` | UI text node … references a font atlas that is not ready. | —    | `packages/webgpu/src/app/ui.ts` |

## uiFrame.textInvalidFontAtlas (1)

| Code                           | Message                                          | Fix? | Emitted from                    |
| ------------------------------ | ------------------------------------------------ | ---- | ------------------------------- |
| `uiFrame.textInvalidFontAtlas` | UI text node … has an invalid font atlas handle. | —    | `packages/webgpu/src/app/ui.ts` |

## uiFrame.textMissingFontPage (1)

| Code                          | Message                                              | Fix? | Emitted from                    |
| ----------------------------- | ---------------------------------------------------- | ---- | ------------------------------- |
| `uiFrame.textMissingFontPage` | UI text node … references missing font atlas page …. | —    | `packages/webgpu/src/app/ui.ts` |

## uiFrame.textMissingPipelineLayouts (1)

| Code                                 | Message                                                | Fix? | Emitted from                    |
| ------------------------------------ | ------------------------------------------------------ | ---- | ------------------------------- |
| `uiFrame.textMissingPipelineLayouts` | MSDF text pipeline does not expose bind group layouts. | —    | `packages/webgpu/src/app/ui.ts` |

## uiQuadRenderPipeline.createRenderPipelineUnavailable (1)

| Code                                                   | Message                                               | Fix? | Emitted from                                        |
| ------------------------------------------------------ | ----------------------------------------------------- | ---- | --------------------------------------------------- |
| `uiQuadRenderPipeline.createRenderPipelineUnavailable` | WebGPU device cannot create UI quad render pipelines. | —    | `packages/webgpu/src/render/ui/ui-quad-pipeline.ts` |

## uiQuadRenderPipeline.pipelineCreationFailed (1)

| Code                                          | Message                       | Fix? | Emitted from                                        |
| --------------------------------------------- | ----------------------------- | ---- | --------------------------------------------------- |
| `uiQuadRenderPipeline.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/render/ui/ui-quad-pipeline.ts` |

## uiQuadRenderPipeline.shaderCreationFailed (1)

| Code                                        | Message                                               | Fix? | Emitted from                                        |
| ------------------------------------------- | ----------------------------------------------------- | ---- | --------------------------------------------------- |
| `uiQuadRenderPipeline.shaderCreationFailed` | WebGPU device cannot create UI quad render pipelines. | —    | `packages/webgpu/src/render/ui/ui-quad-pipeline.ts` |

## uiQuadRenderPipeline.shaderDiagnostic (1)

| Code                                    | Message                       | Fix? | Emitted from                                        |
| --------------------------------------- | ----------------------------- | ---- | --------------------------------------------------- |
| `uiQuadRenderPipeline.shaderDiagnostic` | (message composed at runtime) | —    | `packages/webgpu/src/render/ui/ui-quad-pipeline.ts` |

## unlitBindGroup.missingBaseColorSamplerResource (1)

| Code                                             | Message                                                                    | Fix? | Emitted from                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `unlitBindGroup.missingBaseColorSamplerResource` | Textured unlit bind group planning requires a base-color sampler resource. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroup.missingBaseColorTextureResource (1)

| Code                                             | Message                                                                    | Fix? | Emitted from                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `unlitBindGroup.missingBaseColorTextureResource` | Textured unlit bind group planning requires a base-color texture resource. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroup.missingMaterialResource (1)

| Code                                     | Message                                                         | Fix? | Emitted from                                              |
| ---------------------------------------- | --------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `unlitBindGroup.missingMaterialResource` | Unlit bind group planning requires a material uniform resource. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroup.missingTransformResource (1)

| Code                                      | Message                                                                   | Fix? | Emitted from                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unlitBindGroup.missingTransformResource` | DebugNormal shared bind group planning requires a world transform buffer. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-frame-resources.ts`<br>`packages/webgpu/src/materials/matcap/matcap-frame-resources.ts`<br>`packages/webgpu/src/materials/standard/standard-frame-resources.ts`<br>`packages/webgpu/src/materials/unlit/unlit-bind-group.ts`<br>`packages/webgpu/src/materials/unlit/unlit-frame-resources.ts` |

## unlitBindGroup.missingViewResource (1)

| Code                                 | Message                                                         | Fix? | Emitted from                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unlitBindGroup.missingViewResource` | DebugNormal shared bind group planning requires a view uniform. | —    | `packages/webgpu/src/materials/debug-normal/debug-normal-frame-resources.ts`<br>`packages/webgpu/src/materials/matcap/matcap-frame-resources.ts`<br>`packages/webgpu/src/materials/standard/standard-frame-resources.ts`<br>`packages/webgpu/src/materials/unlit/unlit-bind-group.ts`<br>`packages/webgpu/src/materials/unlit/unlit-frame-resources.ts` |

## unlitBindGroupLayout.missingBinding (1)

| Code                                  | Message                                                | Fix? | Emitted from                                                     |
| ------------------------------------- | ------------------------------------------------------ | ---- | ---------------------------------------------------------------- |
| `unlitBindGroupLayout.missingBinding` | Unlit shader metadata is missing '…' binding metadata. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group-layout.ts` |

## unlitBindGroupLayout.unsupportedResource (1)

| Code                                       | Message                                 | Fix? | Emitted from                                                     |
| ------------------------------------------ | --------------------------------------- | ---- | ---------------------------------------------------------------- |
| `unlitBindGroupLayout.unsupportedResource` | Unsupported unlit binding resource '…'. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group-layout.ts` |

## unlitBindGroupResource.duplicateBinding (1)

| Code                                      | Message                                          | Fix? | Emitted from                                              |
| ----------------------------------------- | ------------------------------------------------ | ---- | --------------------------------------------------------- |
| `unlitBindGroupResource.duplicateBinding` | Duplicate unlit bind group binding … in group …. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroupResource.invalidDescriptorPlan (1)

| Code                                           | Message                                                                   | Fix? | Emitted from                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `unlitBindGroupResource.invalidDescriptorPlan` | Cannot create complete unlit bind groups from an invalid descriptor plan. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroupResource.missingBufferResource (1)

| Code                                           | Message                                            | Fix? | Emitted from                                              |
| ---------------------------------------------- | -------------------------------------------------- | ---- | --------------------------------------------------------- |
| `unlitBindGroupResource.missingBufferResource` | Missing GPU buffer resource '…' for unlit group …. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroupResource.missingDeviceSupport (1)

| Code                                          | Message                                  | Fix? | Emitted from                                              |
| --------------------------------------------- | ---------------------------------------- | ---- | --------------------------------------------------------- |
| `unlitBindGroupResource.missingDeviceSupport` | WebGPU device cannot create bind groups. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroupResource.missingLayout (1)

| Code                                   | Message                                               | Fix? | Emitted from                                              |
| -------------------------------------- | ----------------------------------------------------- | ---- | --------------------------------------------------------- |
| `unlitBindGroupResource.missingLayout` | Missing bind group layout resource for unlit group …. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroupResource.missingRequiredBinding (1)

| Code                                            | Message                                               | Fix? | Emitted from                                              |
| ----------------------------------------------- | ----------------------------------------------------- | ---- | --------------------------------------------------------- |
| `unlitBindGroupResource.missingRequiredBinding` | Unlit bind group … is missing required binding … (…). | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroupResource.missingSamplerResource (1)

| Code                                            | Message                                             | Fix? | Emitted from                                              |
| ----------------------------------------------- | --------------------------------------------------- | ---- | --------------------------------------------------------- |
| `unlitBindGroupResource.missingSamplerResource` | Missing GPU sampler resource '…' for unlit group …. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroupResource.missingTextureResource (1)

| Code                                            | Message                                                  | Fix? | Emitted from                                              |
| ----------------------------------------------- | -------------------------------------------------------- | ---- | --------------------------------------------------------- |
| `unlitBindGroupResource.missingTextureResource` | Missing GPU texture view resource '…' for unlit group …. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroupResource.nullDescriptorPlan (1)

| Code                                        | Message                                                      | Fix? | Emitted from                                              |
| ------------------------------------------- | ------------------------------------------------------------ | ---- | --------------------------------------------------------- |
| `unlitBindGroupResource.nullDescriptorPlan` | Cannot create unlit bind groups from a null descriptor plan. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroupResource.resourceKindMismatch (1)

| Code                                          | Message                                             | Fix? | Emitted from                                              |
| --------------------------------------------- | --------------------------------------------------- | ---- | --------------------------------------------------------- |
| `unlitBindGroupResource.resourceKindMismatch` | Unlit bind group … binding … expects …, received …. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitBindGroupResource.skippedRequiredGroup (1)

| Code                                          | Message                                                | Fix? | Emitted from                                              |
| --------------------------------------------- | ------------------------------------------------------ | ---- | --------------------------------------------------------- |
| `unlitBindGroupResource.skippedRequiredGroup` | Required unlit bind group … has no descriptor entries. | —    | `packages/webgpu/src/materials/unlit/unlit-bind-group.ts` |

## unlitFrameResources.missingMaterial (1)

| Code                                  | Message                                                      | Fix? | Emitted from                                                   |
| ------------------------------------- | ------------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `unlitFrameResources.missingMaterial` | Unlit frame GPU resource creation requires a material asset. | —    | `packages/webgpu/src/materials/unlit/unlit-frame-resources.ts` |

## unlitFrameResources.missingMaterials (1)

| Code                                   | Message                                                                                | Fix? | Emitted from                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `unlitFrameResources.missingMaterials` | Multi-material unlit frame GPU resource creation requires at least one material asset. | —    | `packages/webgpu/src/materials/unlit/unlit-frame-resources.ts` |

## unlitFrameResources.missingMesh (1)

| Code                              | Message                                                  | Fix? | Emitted from                                                   |
| --------------------------------- | -------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `unlitFrameResources.missingMesh` | Unlit frame GPU resource creation requires a mesh asset. | —    | `packages/webgpu/src/materials/unlit/unlit-frame-resources.ts` |

## unlitFrameResources.missingViewUniforms (1)

| Code                                      | Message                                                          | Fix? | Emitted from                                                   |
| ----------------------------------------- | ---------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `unlitFrameResources.missingViewUniforms` | Unlit frame GPU resource creation requires packed view uniforms. | —    | `packages/webgpu/src/materials/unlit/unlit-frame-resources.ts` |

## unlitFrameResources.missingWorldTransforms (1)

| Code                                         | Message                                                             | Fix? | Emitted from                                                   |
| -------------------------------------------- | ------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `unlitFrameResources.missingWorldTransforms` | Unlit frame GPU resource creation requires packed world transforms. | —    | `packages/webgpu/src/materials/unlit/unlit-frame-resources.ts` |

## unlitMaterialBuffer.invalidUniformData (1)

| Code                                     | Message                                                            | Fix? | Emitted from                                                   |
| ---------------------------------------- | ------------------------------------------------------------------ | ---- | -------------------------------------------------------------- |
| `unlitMaterialBuffer.invalidUniformData` | Packed unlit material uniform data must contain at least 4 floats. | —    | `packages/webgpu/src/materials/unlit/unlit-material-buffer.ts` |

## unlitMaterialBuffer.invalidUsageFlags (1)

| Code                                    | Message                                                               | Fix? | Emitted from                                                   |
| --------------------------------------- | --------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `unlitMaterialBuffer.invalidUsageFlags` | Unlit material uniform buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/materials/unlit/unlit-material-buffer.ts` |

## unlitMaterialBuffer.nullPackedMaterial (1)

| Code                                     | Message                                                                           | Fix? | Emitted from                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `unlitMaterialBuffer.nullPackedMaterial` | Cannot create an unlit material buffer descriptor from null packed material data. | —    | `packages/webgpu/src/materials/unlit/unlit-material-buffer.ts` |

## unlitMaterialGpuBuffer.creationFailed (1)

| Code                                    | Message                                               | Fix? | Emitted from                                                            |
| --------------------------------------- | ----------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `unlitMaterialGpuBuffer.creationFailed` | Failed to create unlit material uniform buffer '…': … | —    | `packages/webgpu/src/materials/unlit/unlit-material-buffer-resource.ts` |

## unlitMaterialGpuBuffer.nullDescriptorPlan (1)

| Code                                        | Message                                                                 | Fix? | Emitted from                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- |
| `unlitMaterialGpuBuffer.nullDescriptorPlan` | Cannot create an unlit material GPU buffer from a null descriptor plan. | —    | `packages/webgpu/src/materials/unlit/unlit-material-buffer-resource.ts` |

## unlitPipeline.missingBatchKeyField (1)

| Code                                 | Message                                                  | Fix? | Emitted from                                                       |
| ------------------------------------ | -------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `unlitPipeline.missingBatchKeyField` | Unlit pipeline descriptor planning requires a batch key. | —    | `packages/webgpu/src/materials/unlit/unlit-pipeline-descriptor.ts` |

## unlitPipeline.missingColorFormat (1)

| Code                               | Message                                                     | Fix? | Emitted from                                                       |
| ---------------------------------- | ----------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `unlitPipeline.missingColorFormat` | Unlit pipeline descriptor planning requires a color format. | —    | `packages/webgpu/src/materials/unlit/unlit-pipeline-descriptor.ts` |

## unlitPipeline.missingShaderMetadata (1)

| Code                                  | Message                                                     | Fix? | Emitted from                                                       |
| ------------------------------------- | ----------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `unlitPipeline.missingShaderMetadata` | Unlit pipeline descriptor planning requires a color format. | —    | `packages/webgpu/src/materials/unlit/unlit-pipeline-descriptor.ts` |

## unlitPipeline.unsupportedTopology (1)

| Code                                | Message                                                                | Fix? | Emitted from                                                       |
| ----------------------------------- | ---------------------------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `unlitPipeline.unsupportedTopology` | Unlit pipeline supports triangle-list and line-list topology, not '…'. | —    | `packages/webgpu/src/materials/unlit/unlit-pipeline-descriptor.ts` |

## unlitRenderPipeline.createRenderPipelineUnavailable (1)

| Code                                                  | Message                                       | Fix? | Emitted from                                            |
| ----------------------------------------------------- | --------------------------------------------- | ---- | ------------------------------------------------------- |
| `unlitRenderPipeline.createRenderPipelineUnavailable` | WebGPU device cannot create render pipelines. | —    | `packages/webgpu/src/materials/unlit/unlit-pipeline.ts` |

## unlitRenderPipeline.descriptorPlanFailed (1)

| Code                                       | Message                       | Fix? | Emitted from                                            |
| ------------------------------------------ | ----------------------------- | ---- | ------------------------------------------------------- |
| `unlitRenderPipeline.descriptorPlanFailed` | (message composed at runtime) | —    | `packages/webgpu/src/materials/unlit/unlit-pipeline.ts` |

## unlitRenderPipeline.pipelineCreationFailed (1)

| Code                                         | Message                       | Fix? | Emitted from                                            |
| -------------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------- |
| `unlitRenderPipeline.pipelineCreationFailed` | (message composed at runtime) | —    | `packages/webgpu/src/materials/unlit/unlit-pipeline.ts` |

## unlitRenderPipeline.shaderCreationFailed (1)

| Code                                       | Message                                       | Fix? | Emitted from                                            |
| ------------------------------------------ | --------------------------------------------- | ---- | ------------------------------------------------------- |
| `unlitRenderPipeline.shaderCreationFailed` | WebGPU device cannot create render pipelines. | —    | `packages/webgpu/src/materials/unlit/unlit-pipeline.ts` |

## unlitRenderPipeline.shaderDiagnostic (1)

| Code                                   | Message                       | Fix? | Emitted from                                            |
| -------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------- |
| `unlitRenderPipeline.shaderDiagnostic` | (message composed at runtime) | —    | `packages/webgpu/src/materials/unlit/unlit-pipeline.ts` |

## viewRectangle.emptyRect (1)

| Code                      | Message                       | Fix? | Emitted from                                            |
| ------------------------- | ----------------------------- | ---- | ------------------------------------------------------- |
| `viewRectangle.emptyRect` | (message composed at runtime) | —    | `packages/webgpu/src/resources/views/view-rectangle.ts` |

## viewRectangle.invalidRect (1)

| Code                        | Message                       | Fix? | Emitted from                                            |
| --------------------------- | ----------------------------- | ---- | ------------------------------------------------------- |
| `viewRectangle.invalidRect` | (message composed at runtime) | —    | `packages/webgpu/src/resources/views/view-rectangle.ts` |

## viewRectangle.invalidTargetSize (1)

| Code                              | Message                       | Fix? | Emitted from                                            |
| --------------------------------- | ----------------------------- | ---- | ------------------------------------------------------- |
| `viewRectangle.invalidTargetSize` | (message composed at runtime) | —    | `packages/webgpu/src/resources/views/view-rectangle.ts` |

## viewUniform.duplicateViewId (1)

| Code                          | Message                                 | Fix? | Emitted from                                                                                       |
| ----------------------------- | --------------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `viewUniform.duplicateViewId` | Duplicate view id … in render snapshot. | —    | `packages/render/src/rendering/view-pack-write.ts`<br>`packages/render/src/rendering/view-pack.ts` |

## viewUniform.emptySnapshot (1)

| Code                        | Message                               | Fix? | Emitted from                                                                                       |
| --------------------------- | ------------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `viewUniform.emptySnapshot` | Render snapshot has no views to pack. | —    | `packages/render/src/rendering/view-pack-write.ts`<br>`packages/render/src/rendering/view-pack.ts` |

## viewUniform.matrixOutOfRange (1)

| Code                           | Message                                                                      | Fix? | Emitted from                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `viewUniform.matrixOutOfRange` | View … view-projection matrix offset … is outside snapshot view matrix data. | —    | `packages/render/src/rendering/view-pack-write.ts`<br>`packages/render/src/rendering/view-pack.ts` |

## viewUniform.missingMatrixData (1)

| Code                            | Message                                                             | Fix? | Emitted from                                                                                       |
| ------------------------------- | ------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `viewUniform.missingMatrixData` | View … cannot be packed because snapshot view matrix data is empty. | —    | `packages/render/src/rendering/view-pack-write.ts`<br>`packages/render/src/rendering/view-pack.ts` |

## viewUniformBuffer.emptyData (1)

| Code                          | Message                                                         | Fix? | Emitted from                                                 |
| ----------------------------- | --------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `viewUniformBuffer.emptyData` | Packed view uniform data must contain at least one view matrix. | —    | `packages/webgpu/src/resources/views/view-uniform-buffer.ts` |

## viewUniformBuffer.invalidUsageFlags (1)

| Code                                  | Message                                                     | Fix? | Emitted from                                                 |
| ------------------------------------- | ----------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `viewUniformBuffer.invalidUsageFlags` | View uniform buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/views/view-uniform-buffer.ts` |

## viewUniformBuffer.packDiagnostic (1)

| Code                               | Message                                                     | Fix? | Emitted from                                                 |
| ---------------------------------- | ----------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `viewUniformBuffer.packDiagnostic` | View uniform buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/views/view-uniform-buffer.ts` |

## viewUniformGpuBuffer.creationFailed (1)

| Code                                  | Message                                     | Fix? | Emitted from                                                          |
| ------------------------------------- | ------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `viewUniformGpuBuffer.creationFailed` | Failed to create view uniform buffer '…': … | —    | `packages/webgpu/src/resources/views/view-uniform-buffer-resource.ts` |

## viewUniformGpuBuffer.nullDescriptorPlan (1)

| Code                                      | Message                                                              | Fix? | Emitted from                                                          |
| ----------------------------------------- | -------------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `viewUniformGpuBuffer.nullDescriptorPlan` | Cannot create a view uniform GPU buffer from a null descriptor plan. | —    | `packages/webgpu/src/resources/views/view-uniform-buffer-resource.ts` |

## webgpu.postGraph (1)

| Code                                         | Message                                                                                                                                | Fix? | Emitted from                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------- |
| `webgpu.postGraph.shadowCasterGraphDeclined` | Post-processing graph execution was required to fold shadow caster passes into the frame, but this post route is not graph-compatible. | —    | `packages/webgpu/src/app/post-processing.ts` |

## webgpu.userPass (3)

| Code                                             | Message                                                                                                                                                                                  | Fix? | Emitted from                                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------- |
| `webgpu.userPass.forwardTargetUnavailable`       | Registered user passes were skipped: the forward FrameGraph route rendered no swapchain target this frame to host them.                                                                  | —    | `packages/webgpu/src/app/frame-boundaries.ts`                                                 |
| `webgpu.userPass.renderWriteCoercedToSceneColor` | User render pass '…' declared write target(s) … that are not honored; it is drawn over scene-color (LOAD). Use a compute pass for arbitrary writable targets, or write to "scene-color". | —    | `packages/webgpu/src/app/frame-boundaries.ts`<br>`packages/webgpu/src/app/post-processing.ts` |
| `webgpu.userPass.skippedOnLegacyRoute`           | Registered user passes … run only on the FrameGraph routes (forward graph or post-effect graph); the legacy multi-submit route skipped them. Enable useFrameGraph to run them.           | —    | `packages/webgpu/src/app/user-pass.ts`                                                        |

## webGpuApp.clusteredLocalCookieSamplingDeferred (1)

| Code                                             | Message                                                                                                                                                                                     | Fix? | Emitted from                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `webGpuApp.clusteredLocalCookieSamplingDeferred` | Clustered local cookie sampling is deferred for … light(s) (…); those lights render without their cookie texture (in-shader sentinel) until the variant supports clustered cookie sampling. | —    | `packages/webgpu/src/lighting/local-light-cluster-report.ts` |

## webGpuApp.clusteredLocalShadowSamplingDeferred (1)

| Code                                             | Message                                                                                                                                                                   | Fix? | Emitted from                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `webGpuApp.clusteredLocalShadowSamplingDeferred` | Clustered local shadow sampling is deferred for … light(s) (…); those lights render unshadowed (in-shader sentinel) until the variant supports clustered shadow sampling. | —    | `packages/webgpu/src/lighting/local-light-cluster-report.ts` |

## webGpuApp.customWgslBindingNotPrepared (1)

| Code                                     | Message                       | Fix? | Emitted from                                                       |
| ---------------------------------------- | ----------------------------- | ---- | ------------------------------------------------------------------ |
| `webGpuApp.customWgslBindingNotPrepared` | (message composed at runtime) | —    | `packages/webgpu/src/app/custom-wgsl-texture-sampler-resources.ts` |

## webGpuApp.customWgslMaterialNotPrepared (1)

| Code                                      | Message                                                                      | Fix? | Emitted from                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------ |
| `webGpuApp.customWgslMaterialNotPrepared` | Custom WGSL material source was not prepared before frame resource creation. | —    | `packages/webgpu/src/app/custom-wgsl-frame.ts`<br>`packages/webgpu/src/app/mixed-custom-wgsl-frame.ts` |

## webGpuApp.customWgslMissingDraw (1)

| Code                              | Message                                       | Fix? | Emitted from                                   |
| --------------------------------- | --------------------------------------------- | ---- | ---------------------------------------------- |
| `webGpuApp.customWgslMissingDraw` | Custom WGSL app route requires one mesh draw. | —    | `packages/webgpu/src/app/custom-wgsl-frame.ts` |

## webGpuApp.customWgslMissingSourceAsset (1)

| Code                                     | Message                                                                           | Fix? | Emitted from                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------ |
| `webGpuApp.customWgslMissingSourceAsset` | Custom WGSL app route requires ready mesh and custom WGSL material source assets. | —    | `packages/webgpu/src/app/custom-wgsl-frame.ts`<br>`packages/webgpu/src/app/mixed-custom-wgsl-frame.ts` |

## webGpuApp.customWgslMultiResourceRouteDeferred (1)

| Code                                             | Message                                                                             | Fix? | Emitted from                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- | ---- | ---------------------------------------------- |
| `webGpuApp.customWgslMultiResourceRouteDeferred` | The custom WGSL app route currently supports one custom mesh/material resource set. | —    | `packages/webgpu/src/app/custom-wgsl-frame.ts` |

## webGpuApp.emptySnapshot (1)

| Code                      | Message                                                         | Fix? | Emitted from                            |
| ------------------------- | --------------------------------------------------------------- | ---- | --------------------------------------- |
| `webGpuApp.emptySnapshot` | WebGPU app render requires at least one view and one mesh draw. | —    | `packages/webgpu/src/app/frame-loop.ts` |

## webGpuApp.emptySpriteTextSnapshot (1)

| Code                                | Message                                                                | Fix? | Emitted from                              |
| ----------------------------------- | ---------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `webGpuApp.emptySpriteTextSnapshot` | WebGPU sprite/text render requires at least one sprite or glyph batch. | —    | `packages/webgpu/src/app/sprite-frame.ts` |

## webGpuApp.frameResourceRoute (1)

| Code                           | Message                                                              | Fix? | Emitted from                                                                            |
| ------------------------------ | -------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------- |
| `webGpuApp.frameResourceRoute` | WebGPU app frame resource preparation failed for '…' material route. | —    | `packages/webgpu/src/render/queues/queued-material-frame-resource-route-diagnostics.ts` |

## webGpuApp.materialDependenciesNotReady (1)

| Code                                     | Message                       | Fix? | Emitted from                                                                           |
| ---------------------------------------- | ----------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `webGpuApp.materialDependenciesNotReady` | (message composed at runtime) | —    | `packages/webgpu/src/app/app.ts`<br>`packages/webgpu/src/app/material-dependencies.ts` |

## webGpuApp.materialQueueAssetMismatch (1)

| Code                                   | Message                                                                     | Fix? | Emitted from                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `webGpuApp.materialQueueAssetMismatch` | Render object … pipeline family '…' does not match material asset kind '…'. | —    | `packages/webgpu/src/render/queues/queued-material-prepare-route-diagnostics.ts` |

## webGpuApp.materialQueueRouteReport (1)

| Code                                 | Message                       | Fix? | Emitted from                                                             |
| ------------------------------------ | ----------------------------- | ---- | ------------------------------------------------------------------------ |
| `webGpuApp.materialQueueRouteReport` | (message composed at runtime) | —    | `packages/webgpu/src/render/queues/queued-material-app-resource-item.ts` |

## webGpuApp.missingPipelineLayouts (1)

| Code                               | Message                                                     | Fix? | Emitted from                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------- |
| `webGpuApp.missingPipelineLayouts` | The WebGPU app pipeline does not expose bind group layouts. | —    | `packages/webgpu/src/app/frame-loop.ts`<br>`packages/webgpu/src/render/queues/queued-material-frame-resource-set.ts` |

## webGpuApp.missingSnapshot (1)

| Code                        | Message                                                                                  | Fix? | Emitted from                            |
| --------------------------- | ---------------------------------------------------------------------------------------- | ---- | --------------------------------------- |
| `webGpuApp.missingSnapshot` | Renderer-only WebGPU app rendering requires a RenderSnapshot from the simulation worker. | —    | `packages/webgpu/src/app/frame-loop.ts` |

## webGpuApp.missingSourceAsset (1)

| Code                           | Message                                                    | Fix? | Emitted from                            |
| ------------------------------ | ---------------------------------------------------------- | ---- | --------------------------------------- |
| `webGpuApp.missingSourceAsset` | WebGPU app render requires ready mesh and material assets. | —    | `packages/webgpu/src/app/frame-loop.ts` |

## webGpuApp.pickCreateBindGroupUnavailable (1)

| Code                                       | Message                                                                       | Fix? | Emitted from                         |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ---- | ------------------------------------ |
| `webGpuApp.pickCreateBindGroupUnavailable` | WebGPU app picking requires createBindGroup for view and transform resources. | —    | `packages/webgpu/src/app/picking.ts` |

## webGpuApp.pickDeviceUnavailable (1)

| Code                              | Message                                      | Fix? | Emitted from                               |
| --------------------------------- | -------------------------------------------- | ---- | ------------------------------------------ |
| `webGpuApp.pickDeviceUnavailable` | Entity pick could not drain the GPU queue: … | —    | `packages/webgpu/src/app/picking-frame.ts` |

## webGpuApp.pickEmptySnapshot (1)

| Code                          | Message                                                          | Fix? | Emitted from                               |
| ----------------------------- | ---------------------------------------------------------------- | ---- | ------------------------------------------ |
| `webGpuApp.pickEmptySnapshot` | WebGPU app picking requires at least one view and one mesh draw. | —    | `packages/webgpu/src/app/picking-frame.ts` |

## webGpuApp.pickGpuValidationError (1)

| Code                               | Message                       | Fix? | Emitted from                               |
| ---------------------------------- | ----------------------------- | ---- | ------------------------------------------ |
| `webGpuApp.pickGpuValidationError` | (message composed at runtime) | —    | `packages/webgpu/src/app/picking-frame.ts` |

## webGpuApp.pickInvalidCoordinates (1)

| Code                               | Message                                                  | Fix? | Emitted from                               |
| ---------------------------------- | -------------------------------------------------------- | ---- | ------------------------------------------ |
| `webGpuApp.pickInvalidCoordinates` | WebGPU app picking requires a previously rendered frame. | —    | `packages/webgpu/src/app/picking-frame.ts` |

## webGpuApp.pickLastFrameNotReady (1)

| Code                              | Message                                                            | Fix? | Emitted from                               |
| --------------------------------- | ------------------------------------------------------------------ | ---- | ------------------------------------------ |
| `webGpuApp.pickLastFrameNotReady` | WebGPU app picking requires the latest rendered frame to be ready. | —    | `packages/webgpu/src/app/picking-frame.ts` |

## webGpuApp.pickMissingFrame (1)

| Code                         | Message                                                  | Fix? | Emitted from                               |
| ---------------------------- | -------------------------------------------------------- | ---- | ------------------------------------------ |
| `webGpuApp.pickMissingFrame` | WebGPU app picking requires a previously rendered frame. | —    | `packages/webgpu/src/app/picking-frame.ts` |

## webGpuApp.pickMissingPipeline (1)

| Code                            | Message                                                    | Fix? | Emitted from                               |
| ------------------------------- | ---------------------------------------------------------- | ---- | ------------------------------------------ |
| `webGpuApp.pickMissingPipeline` | WebGPU app picking could not create an ID-buffer pipeline. | —    | `packages/webgpu/src/app/picking-frame.ts` |

## webGpuApp.preparedMaterialFallback (1)

| Code                                 | Message                       | Fix? | Emitted from                                                           |
| ------------------------------------ | ----------------------------- | ---- | ---------------------------------------------------------------------- |
| `webGpuApp.preparedMaterialFallback` | (message composed at runtime) | —    | `packages/webgpu/src/materials/core/prepared-app-material-resource.ts` |

## webGpuApp.renderTargetFormatMismatch (1)

| Code                                   | Message                                                                               | Fix? | Emitted from                              |
| -------------------------------------- | ------------------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `webGpuApp.renderTargetFormatMismatch` | View … targets render target '…' with format '…', but the app pipeline format is '…'. | —    | `packages/webgpu/src/app/frame-target.ts` |

## webGpuApp.renderTargetInvalid (1)

| Code                            | Message                                                                         | Fix? | Emitted from                              |
| ------------------------------- | ------------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `webGpuApp.renderTargetInvalid` | View … targets render target '…' without a valid WebGPU texture and dimensions. | —    | `packages/webgpu/src/app/frame-target.ts` |

## webGpuApp.renderTargetMissing (1)

| Code                            | Message                                         | Fix? | Emitted from                              |
| ------------------------------- | ----------------------------------------------- | ---- | ----------------------------------------- |
| `webGpuApp.renderTargetMissing` | View … targets missing render target asset '…'. | —    | `packages/webgpu/src/app/frame-target.ts` |

## webGpuApp.renderTargetNotReady (1)

| Code                             | Message                                                             | Fix? | Emitted from                              |
| -------------------------------- | ------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `webGpuApp.renderTargetNotReady` | View … targets render target '…' with status '…', expected 'ready'. | —    | `packages/webgpu/src/app/frame-target.ts` |

## webGpuApp.samplerSourceNotReady (1)

| Code                              | Message                                                            | Fix? | Emitted from                                               |
| --------------------------------- | ------------------------------------------------------------------ | ---- | ---------------------------------------------------------- |
| `webGpuApp.samplerSourceNotReady` | Matcap app rendering requires a ready matcap sampler source asset. | —    | `packages/webgpu/src/app/app-texture-sampler-resources.ts` |

## webGpuApp.sharedSnapshotTransportUnsupported (1)

| Code                                           | Message                       | Fix? | Emitted from                                        |
| ---------------------------------------------- | ----------------------------- | ---- | --------------------------------------------------- |
| `webGpuApp.sharedSnapshotTransportUnsupported` | (message composed at runtime) | —    | `packages/webgpu/src/app/app-snapshot-transport.ts` |

## webGpuApp.textureSourceNotReady (1)

| Code                              | Message                                                            | Fix? | Emitted from                                               |
| --------------------------------- | ------------------------------------------------------------------ | ---- | ---------------------------------------------------------- |
| `webGpuApp.textureSourceNotReady` | Matcap app rendering requires a ready matcap texture source asset. | —    | `packages/webgpu/src/app/app-texture-sampler-resources.ts` |

## webGpuApp.transmissionGrabTextureViewUnavailable (1)

| Code                                               | Message                                                                      | Fix? | Emitted from                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------- | ---- | ---------------------------------------------- |
| `webGpuApp.transmissionGrabTextureViewUnavailable` | StandardMaterial transmission grab pass requires a scene color texture view. | —    | `packages/webgpu/src/app/transmission-grab.ts` |

## webGpuApp.unsupportedMaterialKind (1)

| Code                                | Message                                                                                  | Fix? | Emitted from                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | ---- | --------------------------------------- |
| `webGpuApp.unsupportedMaterialKind` | WebGPU app render supports unlit, matcap, standard, and debug-normal materials, not '…'. | —    | `packages/webgpu/src/app/frame-loop.ts` |

## webGpuApp.unsupportedMaterialQueueAlphaTestFamily (1)

| Code                                                | Message                                                                                    | Fix? | Emitted from                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------- |
| `webGpuApp.unsupportedMaterialQueueAlphaTestFamily` | WebGPU app material queue routing supports alpha-test draws for StandardMaterial, not '…'. | —    | `packages/webgpu/src/materials/core/built-in-material-queue-phase.ts` |

## webGpuApp.unsupportedMaterialQueueBlendPreset (1)

| Code                                            | Message                                                                                                   | Fix? | Emitted from                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `webGpuApp.unsupportedMaterialQueueBlendPreset` | WebGPU app material queue routing supports transparent … draws with alpha blending, not blend preset '…'. | —    | `packages/webgpu/src/materials/core/built-in-material-queue-phase.ts` |

## webGpuApp.unsupportedMaterialQueueFamily (1)

| Code                                       | Message                                                                                                  | Fix? | Emitted from                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `webGpuApp.unsupportedMaterialQueueFamily` | WebGPU app material queue routing supports unlit, matcap, standard, and debug-normal materials, not '…'. | —    | `packages/webgpu/src/render/queues/queued-material-prepare-route-diagnostics.ts` |

## webGpuApp.unsupportedMaterialQueuePhase (1)

| Code                                      | Message                                                                                                     | Fix? | Emitted from                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `webGpuApp.unsupportedMaterialQueuePhase` | WebGPU app material queue routing currently supports opaque and StandardMaterial alpha-test draws, not '…'. | —    | `packages/webgpu/src/materials/core/built-in-material-queue-phase.ts` |

## webGpuApp.unsupportedMaterialQueueTransparentFamily (1)

| Code                                                  | Message                                                                                                       | Fix? | Emitted from                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------- |
| `webGpuApp.unsupportedMaterialQueueTransparentFamily` | WebGPU app material queue routing supports transparent draws for StandardMaterial and UnlitMaterial, not '…'. | —    | `packages/webgpu/src/materials/core/built-in-material-queue-phase.ts` |

## webGpuApp.workerSnapshotRenderFailed (1)

| Code                                   | Message                       | Fix? | Emitted from                                                                       |
| -------------------------------------- | ----------------------------- | ---- | ---------------------------------------------------------------------------------- |
| `webGpuApp.workerSnapshotRenderFailed` | (message composed at runtime) | —    | `packages/webgpu/src/app/app.ts`<br>`packages/webgpu/src/app/create-webgpu-app.ts` |

## webGpuMsaaColorTexture.createTextureUnavailable (1)

| Code                                              | Message                                                   | Fix? | Emitted from                      |
| ------------------------------------------------- | --------------------------------------------------------- | ---- | --------------------------------- |
| `webGpuMsaaColorTexture.createTextureUnavailable` | WebGPU MSAA color target creation requires createTexture. | —    | `packages/webgpu/src/gpu/msaa.ts` |

## webGpuMsaaColorTexture.textureCreationFailed (1)

| Code                                           | Message                                                   | Fix? | Emitted from                      |
| ---------------------------------------------- | --------------------------------------------------------- | ---- | --------------------------------- |
| `webGpuMsaaColorTexture.textureCreationFailed` | WebGPU MSAA color texture did not provide a texture view. | —    | `packages/webgpu/src/gpu/msaa.ts` |

## webGpuMsaaColorTexture.textureViewCreationFailed (1)

| Code                                               | Message                                                   | Fix? | Emitted from                      |
| -------------------------------------------------- | --------------------------------------------------------- | ---- | --------------------------------- |
| `webGpuMsaaColorTexture.textureViewCreationFailed` | WebGPU MSAA color texture did not provide a texture view. | —    | `packages/webgpu/src/gpu/msaa.ts` |

## webGpuPostPass.createBindGroupUnavailable (1)

| Code                                        | Message                                                            | Fix? | Emitted from                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webGpuPostPass.createBindGroupUnavailable` | Bloom post effect '…' cannot create a texture sampling bind group. | —    | `packages/webgpu/src/post/post-bloom.ts`<br>`packages/webgpu/src/post/post-dof.ts`<br>`packages/webgpu/src/post/post-fxaa.ts`<br>`packages/webgpu/src/post/post-pass.ts`<br>`packages/webgpu/src/post/post-ssao.ts`<br>`packages/webgpu/src/post/post-ssr.ts`<br>`packages/webgpu/src/post/post-taa.ts`<br>`packages/webgpu/src/post/post-tonemap.ts` |

## webGpuPostPass.createBufferUnavailable (1)

| Code                                     | Message                                                                   | Fix? | Emitted from                             |
| ---------------------------------------- | ------------------------------------------------------------------------- | ---- | ---------------------------------------- |
| `webGpuPostPass.createBufferUnavailable` | Bloom post effect '…' cannot allocate blur parameters without a mip slot. | —    | `packages/webgpu/src/post/post-bloom.ts` |

## webGpuPostPass.createRenderPipelineUnavailable (1)

| Code                                             | Message                                                | Fix? | Emitted from                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webGpuPostPass.createRenderPipelineUnavailable` | Bloom post effect '…' cannot create a render pipeline. | —    | `packages/webgpu/src/post/post-bloom.ts`<br>`packages/webgpu/src/post/post-dof.ts`<br>`packages/webgpu/src/post/post-fxaa.ts`<br>`packages/webgpu/src/post/post-pass.ts`<br>`packages/webgpu/src/post/post-ssao.ts`<br>`packages/webgpu/src/post/post-ssr.ts`<br>`packages/webgpu/src/post/post-taa.ts`<br>`packages/webgpu/src/post/post-tonemap.ts` |

## webGpuPostPass.createSamplerUnavailable (1)

| Code                                      | Message                                               | Fix? | Emitted from                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webGpuPostPass.createSamplerUnavailable` | Bloom post effect '…' cannot create an input sampler. | —    | `packages/webgpu/src/post/post-bloom.ts`<br>`packages/webgpu/src/post/post-dof.ts`<br>`packages/webgpu/src/post/post-fxaa.ts`<br>`packages/webgpu/src/post/post-pass.ts`<br>`packages/webgpu/src/post/post-ssao.ts`<br>`packages/webgpu/src/post/post-ssr.ts`<br>`packages/webgpu/src/post/post-taa.ts`<br>`packages/webgpu/src/post/post-tonemap.ts` |

## webGpuPostPass.createShaderModuleUnavailable (1)

| Code                                           | Message                                              | Fix? | Emitted from                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webGpuPostPass.createShaderModuleUnavailable` | Bloom post effect '…' cannot create a shader module. | —    | `packages/webgpu/src/post/post-bloom.ts`<br>`packages/webgpu/src/post/post-dof.ts`<br>`packages/webgpu/src/post/post-fxaa.ts`<br>`packages/webgpu/src/post/post-pass.ts`<br>`packages/webgpu/src/post/post-ssao.ts`<br>`packages/webgpu/src/post/post-ssr.ts`<br>`packages/webgpu/src/post/post-taa.ts`<br>`packages/webgpu/src/post/post-tonemap.ts` |

## webGpuPostPass.createTextureUnavailable (1)

| Code                                      | Message                                               | Fix? | Emitted from                            |
| ----------------------------------------- | ----------------------------------------------------- | ---- | --------------------------------------- |
| `webGpuPostPass.createTextureUnavailable` | WebGPU post pass cannot create intermediate textures. | —    | `packages/webgpu/src/post/post-pass.ts` |

## webGpuPostPass.depthTextureUnavailable (1)

| Code                                     | Message                                                              | Fix? | Emitted from                                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------- |
| `webGpuPostPass.depthTextureUnavailable` | DOF post effect '…' requires the renderer-owned scene depth texture. | —    | `packages/webgpu/src/post/post-dof.ts`<br>`packages/webgpu/src/post/post-ssao.ts`<br>`packages/webgpu/src/post/post-ssr.ts` |

## webGpuPostPass.inputTextureViewUnavailable (1)

| Code                                         | Message                                                | Fix? | Emitted from                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webGpuPostPass.inputTextureViewUnavailable` | Bloom post effect '…' cannot sample input texture '…'. | —    | `packages/webgpu/src/post/post-bloom.ts`<br>`packages/webgpu/src/post/post-dof.ts`<br>`packages/webgpu/src/post/post-fxaa.ts`<br>`packages/webgpu/src/post/post-pass.ts`<br>`packages/webgpu/src/post/post-ssao.ts`<br>`packages/webgpu/src/post/post-ssr.ts`<br>`packages/webgpu/src/post/post-taa.ts`<br>`packages/webgpu/src/post/post-tonemap.ts` |

## webGpuPostPass.motionVectorTextureUnavailable (1)

| Code                                            | Message                                                              | Fix? | Emitted from                           |
| ----------------------------------------------- | -------------------------------------------------------------------- | ---- | -------------------------------------- |
| `webGpuPostPass.motionVectorTextureUnavailable` | TAA post effect '…' requires a renderer-owned motion-vector texture. | —    | `packages/webgpu/src/post/post-taa.ts` |

## webGpuPostPass.outputTextureUnavailable (1)

| Code                                      | Message                                              | Fix? | Emitted from                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `webGpuPostPass.outputTextureUnavailable` | Post effect '…' prepared an empty post-effect graph. | —    | `packages/webgpu/src/app/post-processing.ts`<br>`packages/webgpu/src/post/post-bloom.ts`<br>`packages/webgpu/src/post/post-taa.ts` |

## webGpuPostPass.pipelineLayoutUnavailable (1)

| Code                                       | Message                                                                   | Fix? | Emitted from                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webGpuPostPass.pipelineLayoutUnavailable` | Bloom post effect '…' pipeline does not expose group 0 bind-group layout. | —    | `packages/webgpu/src/post/post-bloom.ts`<br>`packages/webgpu/src/post/post-dof.ts`<br>`packages/webgpu/src/post/post-fxaa.ts`<br>`packages/webgpu/src/post/post-pass.ts`<br>`packages/webgpu/src/post/post-ssao.ts`<br>`packages/webgpu/src/post/post-ssr.ts`<br>`packages/webgpu/src/post/post-taa.ts`<br>`packages/webgpu/src/post/post-tonemap.ts` |

## webGpuPostPass.textureCreationFailed (1)

| Code                                   | Message                                     | Fix? | Emitted from                            |
| -------------------------------------- | ------------------------------------------- | ---- | --------------------------------------- |
| `webGpuPostPass.textureCreationFailed` | WebGPU post pass texture creation failed: … | —    | `packages/webgpu/src/post/post-pass.ts` |

## webGpuPostPass.writeBufferUnavailable (1)

| Code                                    | Message                                                     | Fix? | Emitted from                             |
| --------------------------------------- | ----------------------------------------------------------- | ---- | ---------------------------------------- |
| `webGpuPostPass.writeBufferUnavailable` | Bloom post effect '…' cannot upload blur parameter buffers. | —    | `packages/webgpu/src/post/post-bloom.ts` |

## worldTransformBuffer.emptyData (1)

| Code                             | Message                                                                 | Fix? | Emitted from                                                         |
| -------------------------------- | ----------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `worldTransformBuffer.emptyData` | Packed world transform data must contain at least one transform matrix. | —    | `packages/webgpu/src/resources/transforms/world-transform-buffer.ts` |

## worldTransformBuffer.invalidUsageFlags (1)

| Code                                     | Message                                                                | Fix? | Emitted from                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `worldTransformBuffer.invalidUsageFlags` | World transform storage buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/transforms/world-transform-buffer.ts` |

## worldTransformBuffer.packDiagnostic (1)

| Code                                  | Message                                                                | Fix? | Emitted from                                                         |
| ------------------------------------- | ---------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `worldTransformBuffer.packDiagnostic` | World transform storage buffer usage flags must be a positive integer. | —    | `packages/webgpu/src/resources/transforms/world-transform-buffer.ts` |

## worldTransformGpuBuffer.creationFailed (1)

| Code                                     | Message                                        | Fix? | Emitted from                                                         |
| ---------------------------------------- | ---------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `worldTransformGpuBuffer.creationFailed` | Failed to create world transform buffer '…': … | —    | `packages/webgpu/src/resources/transforms/world-transform-buffer.ts` |

## worldTransformGpuBuffer.nullDescriptorPlan (1)

| Code                                         | Message                                                                 | Fix? | Emitted from                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `worldTransformGpuBuffer.nullDescriptorPlan` | Cannot create a world transform GPU buffer from a null descriptor plan. | —    | `packages/webgpu/src/resources/transforms/world-transform-buffer.ts` |
