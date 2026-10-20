# spindle-ui-legibility: Make the spindle band and Pipeline pane responsive and legible to a stranger
Status: done
Updated: 2026-10-20T00:39:19.899Z
Next ids: c1 D3 R1 S1

## Goal

Redesign spindle's band and Pipeline pane so they fit any width, explain every control, show per-MSP progress instead of one stalled run stage, and say in a short plain-English line what each step found.

## Done when

## Where things stand

Done. The FEATURE pull request SatanshuMishra/spindle#8 merged into main (e809371); the checkout's main is fast-forwarded to it. pipeline clean removed the run's worktrees, branches (local and remote), run folders and docs/specs files and kept nothing. The run report is saved at ~/.mitosis/spindle/reports/spindle-ui-legibility.json. Band, pane, toasts and live agent attribution were never driven live, only by the plugin suite. pipeline integration-ready checks only that each MSP pull request merged, not that its work reached the FEATURE branch.

Grounding facts: the pipeline run skill defines the round files spindle reads (.diff, .suite.txt, .findings.json, .verdicts.json, .verdict.json, .diagnosis.json), while .suite.run is ad hoc; every finding in all 112 verdict files on this machine has a short `kind` label; the mod API has no Button tooltip prop but offers keyed-Box hover cards and `<title>` tooltips in an interactive Svg, and tests can mount at any width and press Buttons.

## Next step

None: the thread closes as done.

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
