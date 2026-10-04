/** Existing tested pipe bytes; only ownership and fixed instance transforms differ. */
import { constructScene as legacyScene } from "./legacy-scene.mjs";
import { INSTANCE_TRANSLATIONS, PIPE_PARTS } from "../contract.mjs";
export { CONFIG, CAMERAS, PALETTE, linearColor } from "./legacy-scene.mjs";
export function constructScene(edit = "baseline") {
  const legacy = legacyScene(edit),
    parts = [];
  for (const suffix of PIPE_PARTS) {
    const original = legacy.parts.find(
      (p) => p.name === `pipe.hollow-elbow.${suffix}`,
    );
    for (let instance = 0; instance < 3; instance++) {
      const translation = INSTANCE_TRANSLATIONS[instance];
      const worldMatrix = [...original.worldMatrix];
      worldMatrix.splice(12, 3, ...translation);
      parts.push({
        ...original,
        name: `${original.name}.instance-${instance}`,
        partName: original.name,
        instance,
        translation,
        worldMatrix,
      });
    }
  }
  for (const name of ["courtyard.slab", "prop.crate.body"]) {
    const original = legacy.parts.find((p) => p.name === name),
      translation = name === "prop.crate.body" ? [-5, 0, -1.5] : [0, 0, 0],
      worldMatrix = [...original.worldMatrix];
    worldMatrix.splice(12, 3, ...translation);
    parts.push({
      ...original,
      partName: name,
      instance: null,
      translation,
      worldMatrix,
    });
  }
  return {
    ...legacy,
    schema: "aperture.indexed-shared-mesh-fanout.source.v1",
    parts,
  };
}
