# spindle-ui-legibility: Make the spindle band and Pipeline pane responsive and legible to a stranger
Status: parked
Updated: 2026-10-20T00:38:24.707Z
Next ids: c1 D3 R1 S1

## Goal

Redesign spindle's band and Pipeline pane so they fit any width, explain every control, show per-MSP progress instead of one stalled run stage, and say in a short plain-English line what each step found.

## Done when

## Where things stand

Full lane, slug spindle-ui-legibility, in Integration. Review ended green for all three MSPs after two rounds with every advisory fixed. The owner merged SatanshuMishra/spindle#5, #6 and #7 each into its stacked base, so at the owner's word mitosis/band was merged into feat/spindle-ui-legibility (d9a697a, pushed; scripts/check.sh passes, 151 tests); feat now holds all three MSPs, its plugin tree equal to the pane head. pipeline integration-ready checks only that each pull request merged, not that its work reached the FEATURE branch. Lighthouse run 2 (lighthouse/run-2) is green: suite passes on both builds, headless /spindle status on copied run homes proves the stage follows the slowest MSP (main says ship, feat says review round 2), activities and resumed workers; band, pane, toasts and live agent attribution are unproven (no headless driver). The FEATURE pull request is SatanshuMishra/spindle#8 (feat/spindle-ui-legibility into main, body from pull-request render because lighthouse's own body fails the house format hook), open, assigned to SatanshuMishra, CI passing, unmerged. Lighthouse released its worktrees. The integration worktree is ~/.mitosis/runs/spindle/spindle-ui-legibility/integration. The checkout's main is in sync with origin and still holds the uncommitted glossary, ADR 0004/0005 and docs/specs files, which now ship on the FEATURE branch.

Grounding facts: the pipeline run skill defines the round files spindle reads (.diff, .suite.txt, .findings.json, .verdicts.json, .verdict.json, .diagnosis.json), while .suite.run is ad hoc; every finding in all 112 verdict files on this machine has a short `kind` label; the mod API has no Button tooltip prop but offers keyed-Box hover cards and `<title>` tooltips in an interactive Svg, and tests can mount at any width and press Buttons.

## Next step

The owner starts Clean-up by saying the FEATURE pull request SatanshuMishra/spindle#8 merged; then run pipeline metrics --save and pipeline clean for spindle-ui-legibility.

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
