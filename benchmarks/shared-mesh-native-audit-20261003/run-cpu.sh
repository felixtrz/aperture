#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/../.."
OUT="$PWD/benchmarks/shared-mesh-native-audit-20261003"
HELPER=tools/recovery/cleanup.py
expected=1c30bc42425c8ee112e7daf42e6a19e80c0f76949f2161590bc74c33b2f8d00d
[ "$(sha256sum "$HELPER" | cut -d' ' -f1)" = "$expected" ] || exit 90
python3 -B "$HELPER" --root /workspace/scratch/0190a8c72f8a/aperture-tmp --audit-dir "$OUT/lifecycle-audits" run --job shared-mesh-audit-cpu --recreation 'Frozen CPU tests; no browsers' -- node --experimental-loader ./benchmarks/shared-mesh-fanout-v2-20261003/cpu-loader.mjs --test benchmarks/shared-mesh-fanout-v2-20261003/cpu.test.mjs benchmarks/shared-mesh-fanout-v2-20261003/indirect.test.mjs benchmarks/shared-mesh-fanout-v2-20261003/observer.test.mjs
