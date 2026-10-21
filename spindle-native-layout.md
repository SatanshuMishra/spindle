# spindle-native-layout: Rebuild spindle's desktop band and pane on native flex, with simpler tooltips
Status: active
Updated: 2026-10-21T19:37:54.580Z
Next ids: c5 D1 R1 S1

## Goal

Make the spindle band and Pipeline pane on the Claude desktop surface fill their width and follow resizes instantly by letting the host's flexbox size them, cut tooltips to one non-overlapping mechanism, and make copy feedback honest.

## Done when

- [ ] c1 Desktop band and pane derive no pixel widths from bodyColumns; the bar, rail and rows fill their width through flex
- [ ] c2 Only one tooltip mechanism remains, cards never cover neighbouring triggers, and no SVG title tooltips remain
- [ ] c3 Copy feedback reflects $.ui.copy's result and the copiedState timer is gone
- [ ] c4 claude plugin test plugins/spindle and scripts/check.sh pass

## Where things stand

Interphase bug pathway, interview: intent round asked, awaiting the owner's answer. Readiness clear; receipts config already committed. Draft repro fails on main; a probe removing the bodyColumns-derived bar width and rail width made it pass, confirming the cause at the tree seam.

## Next step

Record the owner's intent answers in docs/specs/spindle-native-layout.decisions.md, then ask the first frontier round (seams, tooltip set, copy fallback, breakpoints, design fidelity, pre-mortem).

## Decisions in force

## Open risks

## Settled, do not reopen

## Where the details live

- Audit: this session's diagnosis, 2026-10-21 (cause: layout computed in the hook from bodyColumns x 8px; tooltips via two systems; copy result ignored)
- API: Claude Code 2.1.300 plugin-authoring types claude-code.d.ts
- Spec files: docs/specs/spindle-native-layout.{decisions.md,record.json,repro.test.tsx,guard.json}
