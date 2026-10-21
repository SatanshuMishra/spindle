# spindle-native-layout: Rebuild spindle's desktop band and pane on native flex, with simpler tooltips
Status: active
Updated: 2026-10-21T19:55:32.424Z
Next ids: c5 D2 R1 S1

## Goal

Make the spindle band and Pipeline pane on the Claude desktop surface fill their width and follow resizes instantly by letting the host's flexbox size them, cut tooltips to one non-overlapping mechanism, and make copy feedback honest.

## Done when

- [ ] c1 Desktop band and pane derive no pixel widths from bodyColumns; the bar, rail and rows fill their width through flex
- [ ] c2 Only one tooltip mechanism remains, cards never cover neighbouring triggers, and no SVG title tooltips remain
- [ ] c3 Copy feedback reflects $.ui.copy's result and the copiedState timer is gone
- [ ] c4 claude plugin test plugins/spindle and scripts/check.sh pass

## Where things stand

Spec handed off (read-back approved; spec reviewer's seven issues fixed). FEATURE branch fix/spindle-native-layout cut from main 343fbb9. Plan id 76092d037270 (1 Lane, 1 MSP native-layout). First mitosis build running; log at <home>/build-1.log.

## Next step

When the build ends, read the last JSON line of <home>/build-1.log; then review round 1 of MSP native-layout (diff, obligations, suite, code-reviewer, conformance-auditor, smoke run note).

Needs: D1.

## Decisions in force

- D1 Interphase hand-off: build the approved spec as one MSP of two Steps: One MSP, native-layout, built from the FEATURE branch that pipeline feature-branch cuts.

## Open risks

## Settled, do not reopen

## Where the details live

- Audit: this session's diagnosis, 2026-10-21 (cause: layout computed in the hook from bodyColumns x 8px; tooltips via two systems; copy result ignored)
- API: Claude Code 2.1.300 plugin-authoring types claude-code.d.ts
- Spec files: docs/specs/spindle-native-layout.{decisions.md,record.json,repro.test.tsx,guard.json}
