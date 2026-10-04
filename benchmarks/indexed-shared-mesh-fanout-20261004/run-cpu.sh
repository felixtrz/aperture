#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
fixture="$PWD/benchmarks/indexed-shared-mesh-fanout-20261004"
name="${1:?Provide a new log basename, such as cpu-002.log}"
[[ "$name" =~ ^cpu-[0-9]{3}\.log$ ]] || exit 2
test ! -e "$fixture/$name"
printf '%s\n' '1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d  tools/recovery/cleanup.py' | sha256sum -c -
set -o noclobber
python3 -B tools/recovery/cleanup.py \
  --root /workspace/scratch/0190a8c72f8a/aperture-tmp \
  --audit-dir "$fixture/lifecycle-audits" \
  run --job indexed-fixture-cpu --recreation 'CPU-only indexed fixture tests; no browser or server' -- \
  node --test --test-reporter=spec "$fixture/cpu.test.mjs" "$fixture/indirect.test.mjs" "$fixture/observer.test.mjs" \
  > "$fixture/$name" 2>&1
cat "$fixture/$name"
