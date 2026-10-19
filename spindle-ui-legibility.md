# spindle-ui-legibility: Make the spindle band and Pipeline pane responsive and legible to a stranger
Status: active
Updated: 2026-10-19T23:12:03.308Z
Next ids: c1 D2 R1 S1

## Goal

Redesign spindle's band and Pipeline pane so they fit any width, explain every control, show per-MSP progress instead of one stalled run stage, and say in a short plain-English line what each step found.

## Done when

## Where things stand

Full lane, slug spindle-ui-legibility. The owner approved the read-back of preview 2; interphase handed off (record handed-off, ADR 0005 supersedes ADR 0004, glossary terms Activity, Round state and Worker in the checkout, uncommitted until Ship). Stage 2: FEATURE branch feat/spindle-ui-legibility cut at 3fd829b and pushed; run home ~/.mitosis/spindle/spindle-ui-legibility holds CHARTER.md, run.zsh, dispatch.zsh, worker-rules.txt, items.json and graph.json; plan-only gives three stacked MSPs (activity-model, band, pane), one Lane each. The first build committed all three MSPs (gate 46 pass). Round 1 found blockers in all three MSPs (under review/round-1/), every one diagnosed fixable, and the fix pass is done: activity-model at faa0394 (unreadable file read as absent, worktree path prefix match, failing test; advisories duplicated code, primitive obsession), band at 6baba60 (criterion test timeout, failing test; advisories glyph accessible name, empty hover card), pane at 30baf1f (color only meaning, overlapping svg marks; advisory alt text without meaning). Each fix has red-first receipts and empty selecting checks; pane's overlap check is a 2-D rewrite, because the diagnosis's 1-D check misreads the wrapped rows its own fix prescribes. activity-model is merged into band (982e36f) and band into pane (f8a37ee). Round 2 is under review/round-2/: suites pass at all three heads (127, 137, 151); band's conformance audit returned no findings (5.11 to 5.15 met); activity-model's security review returned one LOW (S1, a slash-only worktree path matches every prompt); the three code reviewers are still running. Band's two round-1 slow checks are recorded as passing at 8c31e18 in review/band.proofs.jsonl.

Grounding facts: the pipeline run skill defines the round files spindle reads (.diff, .suite.txt, .findings.json, .verdicts.json, .verdict.json, .diagnosis.json), while .suite.run is ad hoc; every finding in all 112 verdict files on this machine has a short `kind` label; the mod API has no Button tooltip prop but offers keyed-Box hover cards and `<title>` tooltips in an interactive Svg, and tests can mount at any width and press Buttons.

## Next step

Run review round 2 on all three MSPs, previous heads bdc7720, 8c31e18 and 80cbc42.

Needs: D1.

## Decisions in force

- D1 Interphase hand-off: build the approved spec as three stacked MSPs: Recut the Steps so no file falls in two MSPs; plan-only now gives three Lanes in three stacked MSPs (activity-model, band, pane). Build from feat/spindle-ui-legibility.

## Open risks

## Settled, do not reopen

## Where the details live

- Band: plugins/spindle/hooks/draw/band.tsx
- Pane: plugins/spindle/hooks/draw/pane.tsx
- Inference: plugins/spindle/hooks/run/infer.ts
- Stage rule: docs/adr/0005-stage-follows-the-slowest-msp.md (supersedes 0004)
- Spec files: docs/specs/spindle-ui-legibility.md (spec), .decisions.md, .record.json, .items.json; glossary terms Activity, Round state and Worker in GLOSSARY.md
- Run home: ~/.mitosis/spindle/spindle-ui-legibility (CHARTER.md, run.zsh, rounds.md, review/)
- Approved design preview: session scratchpad spindle-preview-2.html, built from preview2.template.html and crabs.js
