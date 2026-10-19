# spindle-ui-legibility: Make the spindle band and Pipeline pane responsive and legible to a stranger
Status: active
Updated: 2026-10-19T21:35:02.503Z
Next ids: c1 D2 R1 S1

## Goal

Redesign spindle's band and Pipeline pane so they fit any width, explain every control, show per-MSP progress instead of one stalled run stage, and say in a short plain-English line what each step found.

## Done when

## Where things stand

Full lane, slug spindle-ui-legibility. The owner approved the read-back of preview 2; interphase handed off (record handed-off, ADR 0005 supersedes ADR 0004, glossary terms Activity, Round state and Worker in the checkout, uncommitted until Ship). Stage 2: FEATURE branch feat/spindle-ui-legibility cut at 3fd829b and pushed; run home ~/.mitosis/spindle/spindle-ui-legibility holds CHARTER.md, run.zsh, dispatch.zsh, worker-rules.txt, items.json and graph.json; plan-only gives three stacked MSPs (activity-model, band, pane), one Lane each. The first build has not started.

Grounding facts: the run stage sticks on Ship because a SHIP=1 call or any pushed MSP sets it and ADR 0004 holds it; the pipeline run skill defines the round files spindle reads (.diff, .suite.txt, .findings.json, .verdicts.json, .verdict.json, .diagnosis.json), while .suite.run is ad hoc; every finding in all 112 verdict files on this machine has a short `kind` label; the pipeline event stream holds only round.verdict lines for the live fireplace run; the mod API has no Button tooltip prop but offers keyed-Box hover cards and `<title>` tooltips in an interactive Svg, and tests can mount at any width and press Buttons.

## Next step

Run the first build with ~/.mitosis/spindle/spindle-ui-legibility/run.zsh in the background, then read mitosis's last JSON line and start review round 1 for each committed MSP.

Needs: D1.

## Decisions in force

- D1 Interphase hand-off: build the approved spec as three stacked MSPs: Recut the Steps so no file falls in two MSPs; plan-only now gives three Lanes in three stacked MSPs (activity-model, band, pane). Build from feat/spindle-ui-legibility.

## Open risks

## Settled, do not reopen

## Where the details live

- Band: plugins/spindle/hooks/draw/band.tsx
- Pane: plugins/spindle/hooks/draw/pane.tsx
- Inference: plugins/spindle/hooks/run/infer.ts
- Stage rule under question: docs/adr/0004-stage-moves-forward.md
- Spec files: docs/specs/spindle-ui-legibility.md (spec), .decisions.md, .record.json, .items.json, .guard.json; glossary terms Activity and Round state in GLOSSARY.md
- Design preview 2 for the owner's approval: session scratchpad preview2.template.html (source, with a /*CRABS*/ slot), crabs.mts (generates crabs.js from crew.ts) and spindle-preview-2.html (the assembled page)
- Superseded first preview: https://claude.ai/artifact/J2j71FhQp8gbNYbjk8VjKZ
