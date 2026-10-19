# spindle-ui-legibility: Make the spindle band and Pipeline pane responsive and legible to a stranger
Status: active
Updated: 2026-10-19T20:31:08.701Z
Next ids: c1 D1 R1 S1

## Goal

Redesign spindle's band and Pipeline pane so they fit any width, explain every control, show per-MSP progress instead of one stalled run stage, and say in a short plain-English line what each step found.

## Done when

## Where things stand

Full lane, interphase feature pathway, slug spindle-ui-legibility. Interview open: intent approved (I1-I4 in the decisions file); frontier round 1 (13 questions: drawing approach, run stage replacing ADR 0004, MSP steps, round summary, default pane, selection, band contents, dismiss, low-value marks, shared wording, test seam, pre-mortem, out of scope) asked, awaiting answers. Lighthouse readiness answered and clear.

Grounding facts: the run stage sticks on Ship because a SHIP=1 call or any pushed MSP sets it and ADR 0004 holds it; round folders already carry per-step markers (.suite.run, .findings.json, .verdicts.json, .verdict.json, diagnoses) and every finding in all 112 verdict files on this machine has a short `kind` label; the pipeline event stream holds only round.verdict lines for the live fireplace run; the mod API has no Button tooltip prop but offers keyed-Box hover cards and `<title>` tooltips in an interactive Svg, and tests can mount at any width and press Buttons.

## Next step

Record the user's frontier round 1 answers in docs/specs/spindle-ui-legibility.decisions.md, write the agreed seam, criteria and Steps to the record, run check_record.py, then ask the next frontier round.

## Decisions in force

## Open risks

## Settled, do not reopen

## Where the details live

- Band: plugins/spindle/hooks/draw/band.tsx
- Pane: plugins/spindle/hooks/draw/pane.tsx
- Inference: plugins/spindle/hooks/run/infer.ts
- Stage rule under question: docs/adr/0004-stage-moves-forward.md
- Spec working files: docs/specs/spindle-ui-legibility.decisions.md, .record.json, .guard.json
- Mod API types: /private/tmp/claude-501/bundled-skills/2.1.299/18600ad4e74c675e67e3e88b787fb22d/plugin-authoring/types/claude-code.d.ts (ButtonProps, SvgProps.isInteractive, BoxProps.hover)
- Pipeline event catalogue: ~/.claude/plugins/cache/pipeline/pipeline/0.8.0/docs/telemetry.md
- Live reference run: ~/.mitosis/field-notes/mac-video-audio-and-recorder-ui (rounds.md, review/round-<n>/)
