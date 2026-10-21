# spindle-visible-decorations: Restore the spindle desktop progress bar and rail connectors that empty-alt Svgs hid
Status: active
Updated: 2026-10-21T21:57:22.237Z
Next ids: c5 D3 R2 S1

## Goal

The desktop band's progress bar and the pane's rail connectors and lanes remainder draw again at every width, the bar never collapses when one piece is not drawn, and a test refuses any desktop Svg with an empty alt.

## Done when

- [ ] c1 No desktop band or pane Svg has an empty alt, and a test fails if one does
- [ ] c2 The spindle bar holds its own height independent of the in-bar pill
- [ ] c3 claude plugin test plugins/spindle and scripts/check.sh pass
- [ ] c4 The owner's desktop hand check shows the bar and the rail connectors

## Where things stand

MSP visible-decorations committed at 206357c on mitosis/visible-decorations (worktree <run dir>/trees/visible-decorations); gate 11 pass, 9 inert (the unchanged 5.4 checks). Review round 1 is running: code-reviewer and conformance-auditor, briefs in <home>/review/round-1/. No security reviewer (no trust boundary); no smoke run (the desktop app cannot be driven).

## Next step

Collect round 1 findings into <home>/review/round-1/visible-decorations.findings.json, then run pipeline candidates, the validator if needed, record and verdict.

Needs: D1.

## Decisions in force

- D1 Interphase hand-off: build the visible-decorations spec as one MSP of one Step: One MSP, visible-decorations, one Step fix-visible-decorations, built by run.zsh from the FEATURE branch fix/spindle-visible-decorations.
- D2 Ship boundary: push mitosis/visible-decorations and open its pull request ready for review: Ship now: SHIP=1 run.zsh --resume without --proven-head (the head moved past the reviewed commit), open the pull request against fix/spindle-visible-decorations via GitHub MCP, assign it to the owner and post the saved comment.

## Open risks

- R1 The cause (the desktop does not draw an Svg with an empty alt) is inferred from the owner's screenshots, not confirmed against the desktop renderer, which is not in the local app bundle. Bears on c4.

## Settled, do not reopen

## Where the details live

- Cause: commit 90ff5e8 gave five decorative Svgs alt="" (band.tsx ticks, tick spacer, in-bar pill; pane.tsx rail connectors, lanes remainder); the desktop does not draw them and the bar's only in-flow height was the pill
- Prior run: spindle-native-layout (done), SatanshuMishra/spindle#12 and #13
- Spec files: docs/specs/spindle-visible-decorations.{md,decisions.md,record.json,items.json,repro.test.tsx} in the owner's checkout; ADR docs/adr/0007-every-desktop-svg-has-an-alt.md (untracked, ships with the PR)
- Run home <home> = ~/.mitosis/spindle/spindle-visible-decorations (CHARTER.md, run.zsh, rounds.md, review/); run dir ~/.mitosis/runs/spindle/spindle-visible-decorations; FEATURE branch fix/spindle-visible-decorations
