# spindle-visible-decorations: Restore the spindle desktop progress bar and rail connectors that empty-alt Svgs hid
Status: parked
Updated: 2026-10-21T22:51:28.447Z
Next ids: c5 D3 R2 S1

## Goal

The desktop band's progress bar and the pane's rail connectors and lanes remainder draw again at every width, the bar never collapses when one piece is not drawn, and a test refuses any desktop Svg with an empty alt.

## Done when

- [x] c1 No desktop band or pane Svg has an empty alt, and a test fails if one does evidence: alt-meaning.test.tsx guard 'every desktop Svg in the <run> run has a non-empty alt at every width' passes for six runs at widths 40-160 at 206357c, and failed for all six at 14c2562 (mitosis gate pass)
- [x] c2 The spindle bar holds its own height independent of the in-bar pill evidence: band.test.tsx 'the desktop bar holds its height without the pill' passes at 201ef95: texture and pill both in flow at 16px, filled part overflow hidden, at fireplace and Spec
- [x] c3 claude plugin test plugins/spindle and scripts/check.sh pass evidence: claude plugin test plugins/spindle 182 pass 0 fail and scripts/check.sh exit 0 at 201ef95
- [x] c4 The owner's desktop hand check shows the bar and the rail connectors evidence: the owner's desktop hand check on spindle 0.2.5 (SatanshuMishra/spindle#18, main f714bfc) passed: the bar texture fills the bar with rounded ends and the rail connectors are visible

## Where things stand

The owner's first hand check of 0.2.4 showed the bar texture and rail connectors as hairlines and the bar's ends square: the desktop shrinks a Svg wider than its box to the box width at its set height. SatanshuMishra/spindle#18 fixed it (strips preserveAspectRatio none, texture and a two-half rounded track cropped with slice) and is merged; the installed plugin is 0.2.5 and the fix worktree and local branch are removed.

## Next step

None: the thread is done.

## Decisions in force

- D1 Interphase hand-off: build the visible-decorations spec as one MSP of one Step: One MSP, visible-decorations, one Step fix-visible-decorations, built by run.zsh from the FEATURE branch fix/spindle-visible-decorations.
- D2 Ship boundary: push mitosis/visible-decorations and open its pull request ready for review: Ship now: SHIP=1 run.zsh --resume without --proven-head (the head moved past the reviewed commit), open the pull request against fix/spindle-visible-decorations via GitHub MCP, assign it to the owner and post the saved comment.

## Open risks


## Settled, do not reopen

## Where the details live

- Cause: commit 90ff5e8 gave five decorative Svgs alt="" (band.tsx ticks, tick spacer, in-bar pill; pane.tsx rail connectors, lanes remainder); the desktop does not draw them and the bar's only in-flow height was the pill
- Prior run: spindle-native-layout (done), SatanshuMishra/spindle#12 and #13
- ADR docs/adr/0007-every-desktop-svg-has-an-alt.md on main: every desktop Svg has a non-empty alt
- Run report ~/.mitosis/spindle/reports/spindle-visible-decorations.json
