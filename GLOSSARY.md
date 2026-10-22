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

**Run record**:
The folder `~/.mitosis/<repo>/records/<slug>/` holding the copies of a run's files that pipeline clean keeps before it deletes the run home; clean-up never deletes it.
_Avoid_: archive, history

**Lifecycle state**:
Where a run is in its life: running, shipped, reopened, cleaned, or one of the final states closed-done, closed-draft, stopped-critical and superseded.
_Avoid_: status (a verdict or an MSP's), phase

**Final status**:
The lifecycle state a run ended in, as its thread's ledger status records it.

**Follow-up run**:
A run that starts after its parent run was cleaned up, to fix what the parent shipped; it has its own slug and thread and names its parent.
_Avoid_: hotfix, rerun

**Reopened**:
A shipped run, not yet cleaned up, that takes a new round of work under its own slug, thread and run home.

**Session file**:
The file `~/.mitosis/sessions/<session id>.json` that names the run homes a Claude Code session drives and its latest anchor.

**Run view**:
The one value that says what a run is doing now: its lane, stage, round, MSPs, review rounds, agents, cost and elapsed time. Every drawing, toast and status line reads it.
_Avoid_: model, snapshot

**Lane**:
How much interview, spec, build and review the pipeline gives a request: full, standard or direct (a hand fix after its parent run was cleaned up).

**Stage**:
Where a run is in the order Spec, Build, Review, Fix, Ship, Integrate, Clean-up, with Done after Clean-up: the earliest stage any MSP without a pull request is at, and Ship once every MSP is green, blocked or has a pull request.
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

**Activity**:
One piece of an MSP's work, in order: Build, a Round, a Fix after a round, or Ship. The last unfinished one is the MSP's current activity.
_Avoid_: step (interphase's unit of build work), phase

**Round state**:
Where an open round is: suite running, reviewing, validating or diagnosing, read from the round's files; a round with a verdict has an outcome instead.

**Worker**:
An agent or a mitosis lane doing work for a run, drawn as one row in Working now with its crew crab; it belongs to the MSP whose label or worktree its prompt names.
_Avoid_: job, task

## Drawing

**Band**:
The row Spindle draws above the prompt.
_Avoid_: banner, status bar

**Run pane**:
The pane `/spindle` toggles, showing the whole run view.

**Crew**:
The crabs that stand for who is working: Captain, Scribe, Builder, Detective, Judge and Courier, each a costume on the same clay crab.

**Card slot**:
The one fixed place in the band or the run pane where a hover card appears; every element with a card reveals it there, so at most one shows.
_Avoid_: tooltip, hint
