# spindle-run-lifecycle: Spindle keeps a run through clean-up and follows a follow-up fix
Status: active
Updated: 2026-10-22T01:12:47.456Z
Next ids: c5 D2 R1 S1

## Goal

Diagnose and fix why the spindle bar and panel vanish when pipeline clean-up runs, and why spindle stays on the shipped run when a follow-up fix starts; give runs a permanent record clean-up cannot delete, a lifecycle table, and a follow-up rule. Then (Job 2 main part, its own thread and pull request) mock up the panel and bar for every final lifecycle state.

## Done when

- [ ] c1 The replay test built from the recorded events fails on today's code and passes after the fix, asserting the panel stays filled after clean-up and spindle follows the follow-up
- [ ] c2 The ledger shows the old thread's final status linked to its follow-up
- [ ] c3 The next real run stays visible through clean-up and follows one deliberate follow-up fix
- [ ] c4 A lifecycle table lists every run state, the event that moves it and the component that emits it

## Where things stand

interphase:bug interview in progress (slug spindle-run-lifecycle): intent I1 to I4 and round 1 (Q1 to Q13) settled in the decisions file; glossary terms added; round 2 (Q14 to Q19: follow-up mechanism, final-status events, shape and order, unchanged behaviour, pre-mortem, out of scope) is out to the owner. Both symptoms reproduce in a probe replay: (a) the first poll after pipeline clean deletes the run home drops the view (poll.ts:43, deliberate since commit 94831ff); (b) spindle stays at stage ship when the old run home exists and the follow-up makes no new run home (session.ts:39), or freezes once a finished view stops polling (poll.ts:53). The event log and frozen report survive clean-up but spindle does not read them.

## Next step

Cut the FEATURE branch with pipeline feature-branch, write the run home ~/.mitosis/spindle/spindle-run-lifecycle (CHARTER.md, worker-rules.txt, dispatch.zsh, run.zsh, items.json, graph.json), run --plan-only, then the first build.

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
