# A cleaned run is read from its run record, and a follow-up is its own run

Spindle reads a run from its run home, then from the run record `~/.mitosis/<repo>/records/<slug>/` that pipeline clean writes before deleting the run home, then from the run's event log, so a run stays shown through clean-up and after it with its final status. A fix after clean-up is a follow-up run with its own slug and thread that names its parent, and spindle follows it through the session file. This replaces hiding a run whose home clean-up deleted, which left the owner unable to see how a run ended, and it reverses the events-first order ADR 0001 planned: the run home and its record carry the per-lane and per-round detail the events do not, so the event log is the last fallback rather than the first source.

Status: accepted

## Consequences

The run record's layout mirrors the run home and the run directory, so a change to what mitosis or the pipeline writes there must reach the record copy in pipeline clean as well.
