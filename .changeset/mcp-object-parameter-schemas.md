---
"@aperture-engine/cli": patch
---

Declare every non-string MCP tool parameter the handlers actually consume.
MCP clients serialize arguments that are not declared in a tool's input
schema as JSON strings, so undeclared object/array/number parameters were
silently dropped: `input_inject` returned `ok: true` with an empty result
(its `pointer`/`actions`/`gamepad` sub-objects never reached the handler)
and `ecs_get_entity` rejected its `{ index, generation }` reference or fell
back to the previous query's entity. All such parameters are now declared
with descriptions, mirroring the working `resource_set.values` pattern:
entity selectors and `value` on `ecs_get_entity`/`ecs_set_component_field`,
query/snapshot filters (`query`, `source`, `withComponents`, `tags`,
`limit`, `entities`) on `ecs_find_entities`/`ecs_query`/`ecs_snapshot`/
`ecs_diff`, camera selectors, transform vectors, and orbit numerics on the
`camera_*` tools, and the `fields` alias on `resource_set`.
