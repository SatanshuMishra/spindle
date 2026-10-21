# spindle-native-layout: Rebuild spindle's desktop band and pane on native flex, with simpler tooltips
Status: active
Updated: 2026-10-21T20:41:33.465Z
Next ids: c5 D3 R3 S1

## Goal

Make the spindle band and Pipeline pane on the Claude desktop surface fill their width and follow resizes instantly by letting the host's flexbox size them, cut tooltips to one non-overlapping mechanism, and make copy feedback honest.

## Done when

- [ ] c1 Desktop band and pane derive no pixel widths from bodyColumns; the bar, rail and rows fill their width through flex
- [ ] c2 Only one tooltip mechanism remains, cards never cover neighbouring triggers, and no SVG title tooltips remain
- [ ] c3 Copy feedback reflects $.ui.copy's result and the copiedState timer is gone
- [ ] c4 claude plugin test plugins/spindle and scripts/check.sh pass

## Where things stand

MSP native-layout at c50fb77 on mitosis/native-layout (worktree ~/.mitosis/runs/spindle/spindle-native-layout/trees/native-layout); suite 171 pass, check.sh green. Round 1 C2-C5 fixed directly (receipt plugins/spindle/tests/alt-meaning.test.tsx); C1 fixed by amendment 1 (gate 2 pass), merged. Review round 2 running: code-reviewer and conformance-auditor on 5.2, briefs in <home>/review/round-2/. No security reviewer (no trust boundary); no smoke run (the desktop app cannot be driven).

## Next step

When the amend-1 build reports, read its last JSON line, merge its branch into mitosis/native-layout in the MSP worktree, rerun pipeline obligations with criteria plus 5.2, then review round 2 (code-reviewer; conformance-auditor on 5.2).

Needs: D2.

## Decisions in force

- D1 Interphase hand-off: build the approved spec as one MSP of two Steps: One MSP, native-layout, built from the FEATURE branch that pipeline feature-branch cuts.
- D2 Amendment 1 hand-off: build band-bar-fill as MSP native-layout-amend-1 into mitosis/native-layout: Pill as its own fixed piece with a pill-width tick offset. Spec 5.2 rows 1 and 3, D3, the pixel-length assumption and 5.11 amended; one Step band-bar-fill, MSP native-layout-amend-1, built by <home>/amend-1.zsh with --feature-branch mitosis/native-layout and --no-push, then merged into mitosis/native-layout.

## Open risks

- R2 The real desktop paint of the amended bar (pill whole at Spec, fill end before the next tick) is provable only by the owner's 5.11 hand check. Bears on c1.

## Settled, do not reopen

## Where the details live

- Audit: this session's diagnosis, 2026-10-21 (cause: layout computed in the hook from bodyColumns x 8px; tooltips via two systems; copy result ignored)
- API: Claude Code 2.1.300 plugin-authoring types claude-code.d.ts
- Spec files: docs/specs/spindle-native-layout.{md,decisions.md,record.json,items.json,amend-1.items.json,repro.test.tsx}
- Run home <home> = ~/.mitosis/spindle/spindle-native-layout (CHARTER.md, run.zsh, amend-1.zsh, rounds.md, review/); run dirs ~/.mitosis/runs/spindle/spindle-native-layout and ~/.mitosis/runs/spindle/spindle-native-layout-amend-1
