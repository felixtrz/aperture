# Reconstruct the longer flat draw-constant confirmation

This batch preserves all 18 fresh native runs, all 1,728 measured frames, every declared order, exact source/runtime inputs, image and resource evidence, required repository checks and archive-backed cleanup receipts. The implementation is unchanged from 11463da4. Earlier experiments remain immutable and their samples are not pooled here.

Run `python reconstruct-evidence.py --help` for verify/restore commands. Restoration requires a fresh destination and recreates exact regular-file bytes and modes. It records symlinks without creating them, never writes original absolute paths, installs dependencies or launches a browser.

The original plan uses absolute workspace paths. Replaying requires a new declaration for the chosen workspace, the pinned Node/pnpm dependencies and approved Chromium 153/Playwright 1.60 runtime through the verified cloud lifecycle. Preserve the original declaration and artifacts. Prior 52-state native correctness is explicitly reused through pinned reports from the committed flat-draw-constants batch.

Queue values are elapsed SwiftShader software WebGPU fence latency, not physical-GPU timestamps. Root performed artifact recalculation and archive readback; this is not independent-agent review.
