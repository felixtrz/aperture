import { APERTURE_GENERATED_COMMAND_EVENT } from "@aperture-engine/app/commands";
const dispatch = (payload: unknown): void => {
  window.dispatchEvent(
    new CustomEvent(APERTURE_GENERATED_COMMAND_EVENT, {
      detail: { channel: "material.study", payload },
    }),
  );
};
for (const name of ["amplitude", "cutout"])
  document
    .querySelector<HTMLInputElement>(`#${name}`)!
    .addEventListener("input", (event) =>
      dispatch({ [name]: Number((event.target as HTMLInputElement).value) }),
    );
let paused = false;
document
  .querySelector<HTMLButtonElement>("#pause")!
  .addEventListener("click", (event) => {
    paused = !paused;
    (event.target as HTMLButtonElement).textContent = paused
      ? "Resume motion"
      : "Pause motion";
    dispatch({ paused });
  });
