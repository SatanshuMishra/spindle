# spindle-ui-legibility: Make the spindle band and Pipeline pane responsive and legible to a stranger
Status: active
Updated: 2026-10-19T23:39:28.400Z
Next ids: c1 D3 R1 S1

## Goal

Redesign spindle's band and Pipeline pane so they fit any width, explain every control, show per-MSP progress instead of one stalled run stage, and say in a short plain-English line what each step found.

## Done when

## Where things stand

Full lane, slug spindle-ui-legibility. The owner approved the read-back of preview 2; interphase handed off (record handed-off, ADR 0005 supersedes ADR 0004, glossary terms Activity, Round state and Worker in the checkout, uncommitted until Ship). Stage 2: FEATURE branch feat/spindle-ui-legibility cut at 3fd829b and pushed; run home ~/.mitosis/spindle/spindle-ui-legibility holds CHARTER.md, run.zsh, dispatch.zsh, worker-rules.txt, items.json and graph.json; plan-only gives three stacked MSPs (activity-model, band, pane), one Lane each. The first build committed all three MSPs (gate 46 pass). Review took two rounds (review/round-1/, review/round-2/, rounds.md): round 1 looped every MSP, round 2 is green for all three with every blocker fixed and S1 rejected as unreachable. Every confirmed advisory is fixed. Ship heads: activity-model b625bd9 (with the glossary and ADR 0004/0005 commit), band c25d71b, pane b0c98d1, each merged up the stack, suites passing (127, 137, 151) and strict tsc clean against the engine's bundled types. Band's two slow checks pass at 03d199e (review/band.proofs.jsonl); pipeline rerun-plan splits a test name holding a comma, so they ran alone through accept.zsh. Ship is under way: comments saved as review/<msp>.comment.md (pane's empty), promote added nothing, the ship boundary is D2; SHIP=1 run.zsh --resume pushed all three branches (gate 25, 10 and 11 pass; exit 6 only for the expected undeclared writes: glossary, ADRs, run-files and session-signals tests), its JSON result and the pull request bodies in the session scratchpad ship/. The activity-model pull request form (mitosis/activity-model into feat/spindle-ui-legibility) waits for the owner to submit it; band and pane open after it. GitHub login SatanshuMishra, repository SatanshuMishra/spindle.

Grounding facts: the pipeline run skill defines the round files spindle reads (.diff, .suite.txt, .findings.json, .verdicts.json, .verdict.json, .diagnosis.json), while .suite.run is ad hoc; every finding in all 112 verdict files on this machine has a short `kind` label; the mod API has no Button tooltip prop but offers keyed-Box hover cards and `<title>` tooltips in an interactive Svg, and tests can mount at any width and press Buttons.

## Next step

Run SHIP=1 ~/.mitosis/spindle/spindle-ui-legibility/run.zsh --resume, read each MSP's title, body, branch and base from its JSON result, then open the three pull requests in stack order through GitHub MCP create_pull_request, assign them to the owner and post the activity-model and band comments.

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
