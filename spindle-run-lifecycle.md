# spindle-run-lifecycle: Spindle keeps a run through clean-up and follows a follow-up fix
Status: active
Updated: 2026-10-22T00:37:13.183Z
Next ids: c5 D1 R1 S1

## Goal

Diagnose and fix why the spindle bar and panel vanish when pipeline clean-up runs, and why spindle stays on the shipped run when a follow-up fix starts; give runs a permanent record clean-up cannot delete, a lifecycle table, and a follow-up rule. Then (Job 2 main part, its own thread and pull request) mock up the panel and bar for every final lifecycle state.

## Done when

- [ ] c1 The replay test built from the recorded events fails on today's code and passes after the fix, asserting the panel stays filled after clean-up and spindle follows the follow-up
- [ ] c2 The ledger shows the old thread's final status linked to its follow-up
- [ ] c3 The next real run stays visible through clean-up and follows one deliberate follow-up fix
- [ ] c4 A lifecycle table lists every run state, the event that moves it and the component that emits it

## Where things stand

interphase:bug interview in progress (slug spindle-run-lifecycle): the intent round is out to the owner. Both symptoms reproduce in a probe replay: (a) the first poll after pipeline clean deletes the run home drops the view (poll.ts:43, deliberate since commit 94831ff); (b) spindle stays at stage ship when the old run home exists and the follow-up makes no new run home (session.ts:39), or freezes once a finished view stops polling (poll.ts:53). The event log and frozen report survive clean-up but spindle does not read them.

## Next step

Record the owner's intent answer in docs/specs/spindle-run-lifecycle.decisions.md, then ask frontier round 1: permanent record shape, follow-up rule, ledger link, seams, and Job 2's questions.

## Decisions in force

## Open risks

## Settled, do not reopen

## Where the details live

- Recording: session 1bb57b78, transcript ~/.claude/projects/-Users-satanshumishra-Documents-DevLabs-spindle/1bb57b78-2c63-4710-ada0-0698dfc00a63.jsonl
- Events: ~/.mitosis/spindle/events/spindle-native-layout.jsonl and spindle-visible-decorations.jsonl
- Session file: ~/.mitosis/sessions/1bb57b78-2c63-4710-ada0-0698dfc00a63.json
- Hand-over note: ~/Library/Application Support/Work Claude/side-session-notes/local_63d28fe9-95f7-415c-b78d-1ef6cb24f3f7/spindle-lifecycle-handover.md
