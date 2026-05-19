# Next Generic Material Contract After Item JSON — 2026-05-19

## Context

Generic queued material app resource items now have a JSON-safe serializer for
route identity plus source/prepared keys. The next contract slice should use
that helper in a diagnostic/reporting surface without exposing public custom
material APIs.

## Candidates

### A. Route report diagnostic routed item details

`createQueuedMaterialAppRouteReportDiagnostic` already builds JSON-safe route
summary diagnostics from queue items and routed items. It currently reports
counts and buckets, but not the source/prepared key split for routed items. It
can include `routedItems` using the new helper while preserving existing
summary fields.

### B. Public app-owned adapter registration

Still deferred by Decision 0011 and Decision 0012. Too broad.

### C. Another StandardMaterial/glTF fidelity slice

Emissive transformed texture status hardening just landed. More fidelity work
is useful, but the current generic contract path has a small obvious next step.

## Selection

Select `task-1780`: include JSON-safe generic routed item key details in
`createQueuedMaterialAppRouteReportDiagnostic`, backed by the existing
test-only material-family fixture.

## Acceptance Reminder

The diagnostic output may include route identity and source/prepared keys only.
It must not include raw mesh/material assets, adapter instances, draw packets,
GPU handles, app caches, or source payload bytes.
