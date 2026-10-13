export interface UiFeature {
  readonly id: "ui";
}

export function uiFeature(): UiFeature {
  return {
    id: "ui",
  };
}
