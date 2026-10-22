# Run lifecycle

A run's lifecycle state is where it is in its life: running, shipped, reopened, cleaned, or one of the final states closed-done, closed-draft, stopped-critical and superseded. The pipeline (`~/Documents/DevLabs/pipeline`) and logbook (`~/Documents/DevLabs/logbook`) emit the events that move a run between states, and spindle, the read-only Claude Code mod that draws a pipeline run, reads them. Spindle reads a run from its run home `~/.mitosis/<repo>/<slug>/`, then from its run record `~/.mitosis/<repo>/records/<slug>/`, then from its event log `~/.mitosis/<repo>/events/<slug>.jsonl`, in that order, and writes nothing.

## Lifecycle states

| State | Entered when | Event | Emitted by | Ledger status | Spindle reads |
|---|---|---|---|---|---|
| running | The run starts or works. | `run.start` (`lane`), `stage.start` (`spec`, `build`), `round.verdict` | `pipeline feature-branch` (`run.start`, `stage.start spec`), `pipeline check-run` (`stage.start build`), `pipeline verdict` (`round.verdict`) | active | The run home, the run directory and the event log. |
| shipped | Every MSP's pull request is open; the run stays shipped through Integration until the FEATURE pull request merges. | `stage.start ship`, then `stage.start integrate` | `pipeline check-run` with `SHIP` set (`ship`), `pipeline integration-ready` (`integrate`); each pull request is opened by the session through the GitHub MCP `create_pull_request` tool and recorded by mitosis in `state.json` | parked | The pull requests in `state.json` and the session's `create_pull_request` calls. |
| reopened | A shipped run takes a new round before its FEATURE pull request merges. | `round.verdict` or `stage.start build` after the latest `stage.start ship` | `pipeline verdict`, `pipeline check-run` | active | The order of the event log. |
| cleaned | `pipeline clean` deleted the run home after writing the run record. | `clean.done` (`record`, `kept`) | `pipeline clean` | parked when clean-up kept something; otherwise the thread closes at once | The run record, or the event log when there is no run record. |
| closed-done | The thread closes done. | `run.end` (`status` done) | the pipeline continuity hook on `close_thread` | done | `run.end`. |
| closed-draft | The run ended with a draft pull request. | `run.end` (`status` done, `draft` true) | the pipeline continuity hook on `close_thread` | done, with the line `Ended as draft pull request #N` and every unmet criterion struck `[~]` with its reason | `run.end`. |
| stopped-critical | A CRITICAL blocker or a hard failure stopped the run with nothing pushed. | `run.fail` (`stage`, `command`, `exit`, `reason`), then `run.end` (`status` `abandoned: stopped at <stage>: <blocker>`) | `pipeline check-run` or `pipeline event` (`run.fail`), the continuity hook on `close_thread` (`run.end`) | `abandoned: stopped at <stage>: <blocker>` | `run.end`. |
| superseded | The run was abandoned unfinished because another run replaced it. | `run.end` (`status` `abandoned: superseded by <slug>`) | the continuity hook on `close_thread` | `abandoned: superseded by <slug>` | `run.end`. |

Parked is not a lifecycle state: `run.park`, written by the continuity hook on `park_thread`, pauses a run in whatever state it is in.

## Follow-up rule

Before the FEATURE pull request merges, a fix to that work is a new round of the same run, with the same slug, thread and run home, which moves the run from shipped to reopened. After clean-up, any fix, a hand fix included, is a follow-up run with its own slug and thread.

The follow-up's thread is opened with `open_thread` and `follows <parent slug>`. Logbook writes `Follows: <parent>` on the child's document and `Followed by: <child>` on the closed parent's document without reopening it. The pipeline continuity hook then:

- creates the child's run home `~/.mitosis/<repo>/<child slug>/` with `CHARTER.md` and `follows.json`, which holds `{"parent": "<parent slug>", "lane": "direct" | "standard" | "full"}`;
- adds that run home to the session file with the anchor `Pipeline anchor: <child> at <home>, thread <child>: follows <parent>` as `latest_anchor`;
- writes `run.start` with `lane` and `follows` to the child's event log.

The parent keeps its final status. Spindle shows the follow-up with the line `follows <parent>` and keeps the parent reachable as a past run.

## Run record

`pipeline clean` writes the run record before it deletes the run home, and clean-up never deletes it. Its layout mirrors the two folders spindle reads for a live run:

| Path | Mirrors | Holds |
|---|---|---|
| `records/<slug>/home/` | The run home `~/.mitosis/<repo>/<slug>/` | `CHARTER.md`, `rounds.md`, `follows.json`, the `review/round-<n>/<msp>.<kind>` files and the `lighthouse/run-<k>/` files |
| `records/<slug>/run/` | The run directory `~/.mitosis/runs/<repo>/<slug>/` | `plan.json`, `state.json` |

Spindle reads both copies with the same readers it uses for a live run home and run directory, so a change to what mitosis or the pipeline writes there must reach the record copy in `pipeline clean` as well.

## Events still to be emitted

The pipeline does not emit these yet. They are built by the pipeline spec `~/Documents/DevLabs/pipeline/docs/specs/pipeline-run-record.md` and the logbook spec `~/Documents/DevLabs/logbook/docs/specs/logbook-thread-follows.md`.

| Event | New fields | Emitted by |
|---|---|---|
| `clean.done` | `record` (the run record's path), `kept` (the count clean-up kept) | `pipeline clean` |
| `run.end` | `status` (the ledger's closing line), `draft` (true for a closed-draft end) | the continuity hook on `close_thread` |
| `run.start` | `follows` (the parent slug), and the `lane` value `direct` | the continuity hook on `open_thread` with `follows` |

A `run.end` line without a `status` field, written before these changes, reads closed-done.

## Proving the lifecycle

Once the pipeline and logbook changes ship, the owner proves the whole lifecycle once:

1. Run one real pipeline run to clean-up, and see it stay in the band and the run pane with `lifecycle closed-done`.
2. Open a follow-up thread with `follows` naming that run, make one deliberate fix, and see spindle show the follow-up with `follows <parent>`.
3. See the parent's ledger document carry `Followed by: <child>`, and the child's carry `Follows: <parent>`.
