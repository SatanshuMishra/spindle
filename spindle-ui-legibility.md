# spindle-ui-legibility: Make the spindle band and Pipeline pane responsive and legible to a stranger
Status: active
Updated: 2026-10-19T22:56:29.439Z
Next ids: c1 D2 R1 S1

## Goal

Redesign spindle's band and Pipeline pane so they fit any width, explain every control, show per-MSP progress instead of one stalled run stage, and say in a short plain-English line what each step found.

## Done when

## Where things stand

Full lane, slug spindle-ui-legibility. The owner approved the read-back of preview 2; interphase handed off (record handed-off, ADR 0005 supersedes ADR 0004, glossary terms Activity, Round state and Worker in the checkout, uncommitted until Ship). Stage 2: FEATURE branch feat/spindle-ui-legibility cut at 3fd829b and pushed; run home ~/.mitosis/spindle/spindle-ui-legibility holds CHARTER.md, run.zsh, dispatch.zsh, worker-rules.txt, items.json and graph.json; plan-only gives three stacked MSPs (activity-model, band, pane), one Lane each. The first build committed all three MSPs (gate 46 pass). Review round 1 (findings, candidates, verdicts and diagnoses under review/round-1/):
- activity-model: loop. Blockers C1, C4 (unreadable file read as absent), C3 (worktree path prefix match), U1-U6 (failing test), all diagnosed fixable; advisories C5 duplicated code, C6 primitive obsession. Fixed on mitosis/activity-model at faa0394 (receipts 5100c87 red at bdc7720; suite 127 pass; the three selecting checks print nothing); not yet merged into band and pane.
- pane: loop. Blockers C1 color only meaning (verdictPicture in hint() with alt worker.words), C2 overlapping svg marks (chip placed first, pips wrapped in the room left, height from rows), both fixable; advisory C4 alt text without meaning.
- band: diagnose. Blockers C1, C2 criterion test timeout and U1-U3 failing test, diagnoses still running; advisories C4 glyph accessible name, C5 empty hover card.

Grounding facts: the pipeline run skill defines the round files spindle reads (.diff, .suite.txt, .findings.json, .verdicts.json, .verdict.json, .diagnosis.json), while .suite.run is ad hoc; every finding in all 112 verdict files on this machine has a short `kind` label; the mod API has no Button tooltip prop but offers keyed-Box hover cards and `<title>` tooltips in an interactive Svg, and tests can mount at any width and press Buttons.

## Next step

Pane's fix pass; record band's two diagnoses and fix it; merge each fixed MSP up the stack and run round 2.

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
