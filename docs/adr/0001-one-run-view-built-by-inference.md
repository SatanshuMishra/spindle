# One run view, built by inference until the pipeline emits events

Spindle draws the band, the run pane, the toasts and `/spindle status` from one value, the run view, held in `$.state` and written by one refresh function. Version 0.1 builds it by inferring the stage and progress from the run's files and the session's tool calls, because the pipeline does not yet emit an event stream. A later events reader (`~/.mitosis/<repo>/events/<slug>.jsonl`) is meant to build the same value first, with inference kept as its fallback, so no drawing changes when it arrives.

Status: accepted

## Consequences

The inference rules mirror the pipeline's current file layout and tool calls, so a change to mitosis or the pipeline's files can make Spindle show "stage ?" until the rules follow it.
