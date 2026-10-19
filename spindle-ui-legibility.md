# spindle-ui-legibility: Make the spindle band and Pipeline pane responsive and legible to a stranger
Status: active
Updated: 2026-10-19T22:39:07.075Z
Next ids: c1 D2 R1 S1

## Goal

Redesign spindle's band and Pipeline pane so they fit any width, explain every control, show per-MSP progress instead of one stalled run stage, and say in a short plain-English line what each step found.

## Done when

## Where things stand

Full lane, slug spindle-ui-legibility. The owner approved the read-back of preview 2; interphase handed off (record handed-off, ADR 0005 supersedes ADR 0004, glossary terms Activity, Round state and Worker in the checkout, uncommitted until Ship). Stage 2: FEATURE branch feat/spindle-ui-legibility cut at 3fd829b and pushed; run home ~/.mitosis/spindle/spindle-ui-legibility holds CHARTER.md, run.zsh, dispatch.zsh, worker-rules.txt, items.json and graph.json; plan-only gives three stacked MSPs (activity-model, band, pane), one Lane each. The first build committed all three MSPs (gate 46 pass). Review round 1: every reviewer replied; review/round-1/<msp>.findings.json and <msp>.md hold the reviewer arrays plus suite U findings (activity-model 13, band 14, pane 4), and pipeline candidates gave 7, 11 and 4 candidates. Main themes: activity-model reads an unreadable state.json or findings.json as absent and still has six old tests encoding the forward-only Ship stage and the status line count, and matches worktree paths by substring; band's two width-sweep tests time out at 5 s, a Courier test still expects '0 agents', and its Buttons are named by glyphs; pane's finished Judge rows show counts only by pip colour and its pips can slide under the chip. The three validators are running.

Grounding facts: the pipeline run skill defines the round files spindle reads (.diff, .suite.txt, .findings.json, .verdicts.json, .verdict.json, .diagnosis.json), while .suite.run is ad hoc; every finding in all 112 verdict files on this machine has a short `kind` label; the mod API has no Button tooltip prop but offers keyed-Box hover cards and `<title>` tooltips in an interactive Svg, and tests can mount at any width and press Buttons.

## Next step

Once every round-1 reviewer has replied, collect each MSP's findings.json (reviewer arrays plus the suite findings), then run pipeline candidates, the validator, record and verdict per MSP.

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
