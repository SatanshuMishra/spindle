# spindle-ui-legibility: Make the spindle band and Pipeline pane responsive and legible to a stranger
Status: active
Updated: 2026-10-19T21:16:48.869Z
Next ids: c1 D1 R1 S1

## Goal

Redesign spindle's band and Pipeline pane so they fit any width, explain every control, show per-MSP progress instead of one stalled run stage, and say in a short plain-English line what each step found.

## Done when

## Where things stand

Full lane, interphase feature pathway, slug spindle-ui-legibility. The spec, record and items reflect the owner's revised design (spindle's crabs, dotted bar and rail kept; "Pipeline Insights" header; Working now lists typed worker rows filtered by the selected MSP; Review rounds removed; band swaps slug for a copy icon and bar for a stage pill when narrow), and all interphase checks pass. Preview 2 is built in spindle's own look and open in the owner's default browser. At its read-back the owner chose "Change something" without saying what; waiting for that change. Hand-off not yet done.

Grounding facts: the run stage sticks on Ship because a SHIP=1 call or any pushed MSP sets it and ADR 0004 holds it; the pipeline run skill defines the round files spindle reads (.diff, .suite.txt, .findings.json, .verdicts.json, .verdict.json, .diagnosis.json), while .suite.run is ad hoc; every finding in all 112 verdict files on this machine has a short `kind` label; the pipeline event stream holds only round.verdict lines for the live fireplace run; the mod API has no Button tooltip prop but offers keyed-Box hover cards and `<title>` tooltips in an interactive Svg, and tests can mount at any width and press Buttons.

## Next step

Get the owner's requested change to preview 2, update the spec and the preview to match, reopen the preview with `open` in the default browser, then read back for approval.

## Decisions in force

## Open risks

## Settled, do not reopen

## Where the details live

- Band: plugins/spindle/hooks/draw/band.tsx
- Pane: plugins/spindle/hooks/draw/pane.tsx
- Inference: plugins/spindle/hooks/run/infer.ts
- Stage rule under question: docs/adr/0004-stage-moves-forward.md
- Spec files: docs/specs/spindle-ui-legibility.md (spec), .decisions.md, .record.json, .items.json, .guard.json; glossary terms Activity and Round state in GLOSSARY.md
- Design preview for the owner's approval: https://claude.ai/artifact/J2j71FhQp8gbNYbjk8VjKZ (source in the session scratchpad, spindle-preview.html)
- Mod API types: /private/tmp/claude-501/bundled-skills/2.1.299/18600ad4e74c675e67e3e88b787fb22d/plugin-authoring/types/claude-code.d.ts (ButtonProps, SvgProps.isInteractive, BoxProps.hover)
- Pipeline event catalogue: ~/.claude/plugins/cache/pipeline/pipeline/0.8.0/docs/telemetry.md
- Live reference run: ~/.mitosis/field-notes/mac-video-audio-and-recorder-ui (rounds.md, review/round-<n>/)
