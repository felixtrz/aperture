/** CPU replay of every retained state with strict current gates, no native execution. */
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SESSION_IDS, statesFor } from "./contract.mjs";
import { validateStateRecord, validateTransition } from "./harness/checks.mjs";
import { checkPins } from "./run.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const freeze = await checkPins();
let count = 0;
for (const session of SESSION_IDS) {
  let previous;
  const states = statesFor(session);
  for (const state of states) {
    const r = JSON.parse(
      await readFile(
        resolve(
          here,
          "renders/aperture",
          session,
          "attempt-001/states",
          state.id + ".json",
        ),
      ),
    );
    validateStateRecord(r, state.index, states);
    validateTransition(r.evidence, state, previous);
    previous = r.evidence;
    count++;
  }
}
console.log(
  JSON.stringify({
    status: "passed",
    states: count,
    sourcePinsSha256: freeze.sha256,
    nativeExecution: false,
  }),
);
