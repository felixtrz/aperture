# Tracker Backlog Alignment After DebugNormal Frame Resources

Date: 2026-05-18

## Scope

Align public tracker status and the ready backlog after the DebugNormalMaterial
frame-resource helper.

## Findings

- The public tracker now records debug-normal material buffer, bind group, and
  frame-resource coverage as implemented prerequisites.
- App-level DebugNormalMaterial routing remains inactive and is still reported
  as missing.
- The ready backlog is refilled with scoped tasks for planning, auditing, app
  cache/reuse integration, and follow-up tracker alignment.

## Validation

- `pnpm run check:progress`

## Recommendation

Start with the next DebugNormal route activation plan. The likely next
implementation slice is app frame-resource cache/reuse integration, not browser
route activation.
