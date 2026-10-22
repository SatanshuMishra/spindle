# spindle-run-lifecycle: Spindle keeps a run through clean-up and follows a follow-up fix
Status: active
Updated: 2026-10-22T01:30:03.564Z
Next ids: c5 D2 R1 S1

## Goal

Diagnose and fix why the spindle bar and panel vanish when pipeline clean-up runs, and why spindle stays on the shipped run when a follow-up fix starts; give runs a permanent record clean-up cannot delete, a lifecycle table, and a follow-up rule. Then (Job 2 main part, its own thread and pull request) mock up the panel and bar for every final lifecycle state.

## Done when

- [ ] c1 The replay test built from the recorded events fails on today's code and passes after the fix, asserting the panel stays filled after clean-up and spindle follows the follow-up
- [ ] c2 The ledger shows the old thread's final status linked to its follow-up
- [ ] c3 The next real run stays visible through clean-up and follows one deliberate follow-up fix
- [ ] c4 A lifecycle table lists every run state, the event that moves it and the component that emits it

## Where things stand

Review round 1 running on both MSPs of FEATURE branch fix/spindle-run-lifecycle: run-record-reader (gate 12 of 12 red-then-green, suite 199 pass) and lifecycle-table (suite 187 pass); both conformance audits found no findings (5.1 to 5.7 met, 5.8 and 5.9 not applicable until the pipeline and logbook changes ship); both code reviews are still running; no security reviewer (read-only local file parsing). Causes proven: (a) poll.ts:43 drops the view once clean-up deletes the run home; (b) session.ts:39 keeps the shipped run when the follow-up makes no run home, and poll.ts:53 freezes a finished view. The pipeline and logbook specs are written in their repositories and need a session launched in each, logbook first.

## Next step

When the four round 1 reviewers return, collect each MSP's findings, run pipeline candidates, the validator, record and verdict, fix what is confirmed, then ship with SHIP=1 after recording the ship decision.

Needs: D1.

## Decisions in force

- D1 Interphase hand-off: spindle-run-lifecycle spec approved for build: Build as one MSP, run-lifecycle, on the FEATURE branch; the pipeline and logbook specs are written while it builds; Job 2 follows once its pull request opens.

## Open risks

## Settled, do not reopen

## Where the details live

- Recording: session 1bb57b78, transcript ~/.claude/projects/-Users-satanshumishra-Documents-DevLabs-spindle/1bb57b78-2c63-4710-ada0-0698dfc00a63.jsonl
- Events: ~/.mitosis/spindle/events/spindle-native-layout.jsonl and spindle-visible-decorations.jsonl
- Session file: ~/.mitosis/sessions/1bb57b78-2c63-4710-ada0-0698dfc00a63.json
- Hand-over note: ~/Library/Application Support/Work Claude/side-session-notes/local_63d28fe9-95f7-415c-b78d-1ef6cb24f3f7/spindle-lifecycle-handover.md
- Interphase files: docs/specs/spindle-run-lifecycle.decisions.md and .record.json in the spindle checkout
- Probe replay: /var/folders/tz/b798spt96sjfyy924nf0cw4c0000gn/T/interphase-probe-_w7ed32t/plugins/spindle/tests/probe-lifecycle.test.ts
- Glossary: GLOSSARY.md in the spindle checkout
- Run home: ~/.mitosis/spindle/spindle-run-lifecycle (charter, run.zsh, rounds.md, review/, MSP assumptions)
- Pipeline spec: ~/Documents/DevLabs/pipeline/docs/specs/pipeline-run-record.md (run record, clean.done, run.end status and draft, follow-up registration, brief msp line)
- Logbook spec: ~/Documents/DevLabs/logbook/docs/specs/logbook-thread-follows.md (open_thread follows, Followed by on the parent)
