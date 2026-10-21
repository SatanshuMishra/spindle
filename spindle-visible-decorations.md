# spindle-visible-decorations: Restore the spindle desktop progress bar and rail connectors that empty-alt Svgs hid
Status: parked
Updated: 2026-10-21T22:02:13.595Z
Next ids: c5 D3 R2 S1

## Goal

The desktop band's progress bar and the pane's rail connectors and lanes remainder draw again at every width, the bar never collapses when one piece is not drawn, and a test refuses any desktop Svg with an empty alt.

## Done when

- [x] c1 No desktop band or pane Svg has an empty alt, and a test fails if one does evidence: alt-meaning.test.tsx guard 'every desktop Svg in the <run> run has a non-empty alt at every width' passes for six runs at widths 40-160 at 206357c, and failed for all six at 14c2562 (mitosis gate pass)
- [x] c2 The spindle bar holds its own height independent of the in-bar pill evidence: band.test.tsx 'the desktop bar holds its height without the pill' passes at 201ef95: texture and pill both in flow at 16px, filled part overflow hidden, at fireplace and Spec
- [x] c3 claude plugin test plugins/spindle and scripts/check.sh pass evidence: claude plugin test plugins/spindle 182 pass 0 fail and scripts/check.sh exit 0 at 201ef95
- [ ] c4 The owner's desktop hand check shows the bar and the rail connectors

## Where things stand

SatanshuMishra/spindle#15 (mitosis/visible-decorations into fix/spindle-visible-decorations) is open, ready for review, assigned to the owner, with the review notes comment. Review round 1 green; advisory C2 fixed; ADR-0007 on the branch.

## Next step

The owner merges SatanshuMishra/spindle#15, then starts Integration by saying the MSP pull requests merged.

Needs: R1.

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
