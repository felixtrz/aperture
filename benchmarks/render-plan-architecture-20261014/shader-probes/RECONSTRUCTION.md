This additive batch retains six completed controlled shader experiments, including failed preparations, failed image checks, successful and failed timing windows, exact built source, raw native traces, images and actual child/lifecycle receipts. These are causal diagnostics on the existing controlled scene, not new independent-author rounds. All timing is SwiftShader software WebGPU queue completion, not hardware GPU timestamps.

Every original file maps to a SHA256 payload in origins.jsonl.gz. Raw payloads are stored once in deterministic USTAR gzip archives; archive-members.jsonl.gz resolves their members. Symlinks are recorded only; installed dependencies are never copied. The manifest and included verifier check every archive member and original size/hash mapping.

```sh
python reconstruct-evidence.py verify /chosen/path/to/shader-probes
python reconstruct-evidence.py restore /chosen/path/to/shader-probes /new/restoration/root
```

Restoration writes only beneath a fresh destination using source-root IDs and relative paths. Original absolute source paths are provenance, never overwrite targets. Rebase private package links and use the retained pinned dependency versions in a separate replay workspace. Browser replay must use runVerifiedScene through the established lifecycle wrapper.

Some redundant private baseline-sdk copies may subsequently be retired after full archive verification; all original bytes remain recoverable here. The final selected renderer, longer confirmation and correctness checks are a separate addendum. No failed result in this batch is retroactively relabeled as passed.
