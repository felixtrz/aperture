---
"@aperture-engine/runtime": patch
---

Remove the dormant render snapshot buffer-pool helpers and recycle protocol
fields after the benchmarked copy/recycle route failed to beat direct
transfer-list snapshots. The live `renderSnapshotTransferList` helper remains
public for transferable worker fallback paths.
