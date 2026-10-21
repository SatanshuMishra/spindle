# spindle-native-layout: Rebuild spindle's desktop band and pane on native flex, with simpler tooltips
Status: active
Updated: 2026-10-21T20:11:16.649Z
Next ids: c5 D2 R2 S1

## Goal

Make the spindle band and Pipeline pane on the Claude desktop surface fill their width and follow resizes instantly by letting the host's flexbox size them, cut tooltips to one non-overlapping mechanism, and make copy feedback honest.

## Done when

- [ ] c1 Desktop band and pane derive no pixel widths from bodyColumns; the bar, rail and rows fill their width through flex
- [ ] c2 Only one tooltip mechanism remains, cards never cover neighbouring triggers, and no SVG title tooltips remain
- [ ] c3 Copy feedback reflects $.ui.copy's result and the copiedState timer is gone
- [ ] c4 claude plugin test plugins/spindle and scripts/check.sh pass

## Where things stand

MSP native-layout committed on mitosis/native-layout at 00a4a85 (gate 12 pass, 2 inert terminal checks); worktree ~/.mitosis/runs/spindle/spindle-native-layout/trees/native-layout. Review round 1 running: code-reviewer and conformance-auditor; no security reviewer (no trust boundary touched); no smoke run (the desktop app cannot be driven).

## Next step

Collect both reviewers' JSON arrays into <home>/review/round-1/native-layout.findings.json, then pipeline candidates, validator if needed, record and verdict.

Needs: D1.

## Decisions in force

- D1 Interphase hand-off: build the approved spec as one MSP of two Steps: One MSP, native-layout, built from the FEATURE branch that pipeline feature-branch cuts.

## Open risks

- R1 The engine refuses CSS pixel strings for Box sizes (cells or percentages only), so the spec's px minWidth for the filled bar part cannot be built; conformance finding A1 (pill can shrink at Spec) needs a cell-free fix. Bears on c1.

## Settled, do not reopen

## Where the details live

- Audit: this session's diagnosis, 2026-10-21 (cause: layout computed in the hook from bodyColumns x 8px; tooltips via two systems; copy result ignored)
- API: Claude Code 2.1.300 plugin-authoring types claude-code.d.ts
- Spec files: docs/specs/spindle-native-layout.{md,decisions.md,record.json,items.json,repro.test.tsx}
- Run home <home> = ~/.mitosis/spindle/spindle-native-layout (CHARTER.md, run.zsh, rounds.md, review/); run dir ~/.mitosis/runs/spindle/spindle-native-layout
