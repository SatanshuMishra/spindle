# Spindle

Spindle is a Claude Code mod that shows what a request-pipeline run is doing, read from the run's files and the session's own events.

## Language

**Run**:
One pass of the request pipeline over one request, named by its slug.
_Avoid_: job, pipeline (for one pass)

**Run home**:
The folder `~/.mitosis/<repo>/<slug>/` that holds a run's charter, run script, review rounds and lighthouse results.
_Avoid_: run folder, workspace

**Run directory**:
The folder `~/.mitosis/runs/<repo>/<slug>/` where mitosis keeps a run's plan, state and lane output.

**Session file**:
The file `~/.mitosis/sessions/<session id>.json` that names the run homes a Claude Code session drives and its latest anchor.

**Run view**:
The one value that says what a run is doing now: its lane, stage, round, MSPs, review rounds, agents, cost and elapsed time. Every drawing, toast and status line reads it.
_Avoid_: model, snapshot

**Lane**:
How much interview, spec, build and review the pipeline gives a request: full or standard.

**Stage**:
Where a run is in the order Spec, Build, Review, Fix, Ship, Integrate, Clean-up, with Done after Clean-up.
_Avoid_: phase (interphase's word for its own steps)

**Round**:
One review of one MSP; an MSP's round n is its nth review.

**MSP**:
One pull request's worth of a run's work, built by mitosis from one or more lanes of Steps.
_Avoid_: chunk, part

**Proof**:
The acceptance gate's evidence for an MSP: a test that failed with the work reverted (red) and passed with it (green).

**Verdict**:
A round's outcome for one MSP: green, loop, diagnose, blocked or hard failure, with its blocker and advisory counts.

## Drawing

**Band**:
The row Spindle draws above the prompt.
_Avoid_: banner, status bar

**Run pane**:
The pane `/spindle` toggles, showing the whole run view.

**Crew**:
The crabs that stand for who is working: Captain, Scribe, Builder, Detective, Judge and Courier, each a costume on the same clay crab.
