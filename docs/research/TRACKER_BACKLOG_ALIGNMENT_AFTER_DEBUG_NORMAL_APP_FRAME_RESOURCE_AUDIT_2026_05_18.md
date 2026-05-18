# Tracker Backlog Alignment After DebugNormal App Frame Resources

Date: 2026-05-18

## Scope

Align public tracker status and the ready backlog after the DebugNormalMaterial
app frame-resource cache/reuse helper.

## Findings

- The public tracker now records debug-normal material buffer, bind group,
  frame-resource, and app frame-resource cache/reuse coverage as implemented
  prerequisites.
- Active app route wiring and browser rendering remain deferred.
- The ready backlog is refilled with scoped tasks for planning, auditing,
  route integration, follow-up audit, and tracker alignment.

## Validation

- `pnpm run check:progress`

## Recommendation

Start with the active route integration plan. The likely next implementation
slice is adding DebugNormalMaterial to the app route resource path with
JSON-safe summaries, not browser pixel coverage yet.
