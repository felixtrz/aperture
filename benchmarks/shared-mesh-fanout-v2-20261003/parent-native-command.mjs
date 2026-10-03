/** Print, never execute, the exact command for one separately admitted native session. */
import { SESSION_IDS } from "./contract.mjs";
const session = process.argv[2];
if (!SESSION_IDS.includes(session) || process.argv.length !== 3)
  throw Error("Choose one separately admitted session");
const repo = "/workspace/scratch/0190a8c72f8a/aperture-recovery-20261002",
  folder = repo + "/benchmarks/shared-mesh-fanout-v2-20261003";
console.log(
  `cd '${repo}' && APERTURE_WEBGPU_RUNTIME='${repo}/.aperture-env/render-runtime' python '${repo}/tools/recovery/runtime_pressure.py' --root /workspace/scratch/0190a8c72f8a/aperture-tmp --audit-dir '${folder}/lifecycle-audits-native' run --job shared-mesh-v2-${session}-attempt001 --recreation 'Reproduce separately admitted frozen shared-mesh ${session} attempt' -- node '${folder}/run.mjs' aperture '${session}' attempt-001`,
);
