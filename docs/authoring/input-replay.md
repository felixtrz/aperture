# Input Replay

Headless input is replayed as generated input events at the same boundary the
browser worker consumes. Tests and tools should enqueue events, not mutate
`InputState` internals directly.

Each deterministic step:

1. Selects the current frame id.
2. Drains queued generated input events for that frame.
3. Advances input frame state once.
4. Runs systems with deterministic `delta` and `time`.
5. Extracts the render snapshot for that frame.
6. Increments the next frame id.

The legacy `--inject` file format remains a compatibility layer. It is
translated into generated input events before stepping:

```json
[
  {
    "atFrame": 0,
    "pointer": { "position": [0.5, 0.5], "pressed": true },
    "actions": { "jump": true }
  }
]
```

Warm serve mode exposes the same replay path through its `inject` command:

```json
{"id":1,"cmd":"inject","params":{"actions":{"jump":true}}}
{"id":2,"cmd":"step","params":{"delta":0.0166666667,"digest":true}}
```

Browser-worker devtools use the same boundary. `ecs_step` accepts an optional
fixed `time` value, so deterministic manual stepping can use the same
`{ delta, time }` sequence as headless:

```json
{ "tool": "ecs_step", "payload": { "delta": 0.0166666667, "time": 0 } }
```

Use status or digest responses to compare one-shot, serve, and browser-worker
manual-step behavior. Browser validation is still needed for raw DOM hardware
events, but deterministic headless replay should operate on the normalized
event stream the simulation actually consumes.
