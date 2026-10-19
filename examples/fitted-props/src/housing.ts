import type { PolygonMeshDescriptorOptions } from "@aperture-engine/app/systems";
import { bridgeProfiles, facing, windowPanel, type Point } from "./panels.ts";

/** The same helpers author a tapered instrument housing, with a fitted display. */
export function instrumentHousingSurfaces(): {
  shell: PolygonMeshDescriptorOptions;
  display: PolygonMeshDescriptorOptions;
} {
  const sections: Point[][] = [
    [
      [0.5, 0, -0.4],
      [0.5, 0.55, -0.4],
      [0.4, 0.67, -0.4],
      [-0.4, 0.67, -0.4],
      [-0.5, 0.55, -0.4],
      [-0.5, 0, -0.4],
    ],
    [
      [0.5, 0, 0.4],
      [0.5, 0.18, 0.4],
      [0.4, 0.3, 0.4],
      [-0.4, 0.3, 0.4],
      [-0.5, 0.18, 0.4],
      [-0.5, 0, 0.4],
    ],
  ];
  const panels = bridgeProfiles(sections[0]!, sections[1]!, true);
  const display = windowPanel(panels[2]!.outline, [0.08, 0.14, 0.92, 0.86]);
  panels[2] = display.surround;
  return {
    shell: {
      faces: [
        ...panels,
        { outline: facing(sections[0]!, [0, 0, -1]) },
        { outline: facing(sections[1]!, [0, 0, 1]) },
      ],
    },
    display: { faces: [display.pane] },
  };
}
