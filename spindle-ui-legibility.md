# spindle-ui-legibility: Make the spindle band and Pipeline pane responsive and legible to a stranger
Status: parked
Updated: 2026-10-20T00:19:13.927Z
Next ids: c1 D3 R1 S1

## Goal

Redesign spindle's band and Pipeline pane so they fit any width, explain every control, show per-MSP progress instead of one stalled run stage, and say in a short plain-English line what each step found.

## Done when

## Where things stand

Full lane, slug spindle-ui-legibility, in Integration. Review ended green for all three MSPs after two rounds with every advisory fixed. The owner merged the MSP pull requests SatanshuMishra/spindle#5, #6 and #7 into feat/spindle-ui-legibility, each passing CI (scripts/check.sh: strict plugin validate on root and plugin, then the suite); pipeline integration-ready reports all three merged. The checkout's main is in sync with origin and still holds the uncommitted glossary, ADR 0004/0005 and docs/specs files, which now ship on the FEATURE branch.

Grounding facts: the pipeline run skill defines the round files spindle reads (.diff, .suite.txt, .findings.json, .verdicts.json, .verdict.json, .diagnosis.json), while .suite.run is ad hoc; every finding in all 112 verdict files on this machine has a short `kind` label; the mod API has no Button tooltip prop but offers keyed-Box hover cards and `<title>` tooltips in an interactive Svg, and tests can mount at any width and press Buttons.

## Next step

Run lighthouse:test run 1 on feat/spindle-ui-legibility against main with results in ~/.mitosis/spindle/spindle-ui-legibility/lighthouse/run-1; it opens the FEATURE pull request.

Needs: D1, D2.

## Decisions in force

- D1 Interphase hand-off: build the approved spec as three stacked MSPs: Recut the Steps so no file falls in two MSPs; plan-only now gives three Lanes in three stacked MSPs (activity-model, band, pane). Build from feat/spindle-ui-legibility.
- D2 Ship spindle-ui-legibility: Ship with no --proven-head: SHIP=1 run.zsh --resume gates all three MSPs again at their current heads, reconciles them and pushes, then the three pull requests open in stack order.

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
