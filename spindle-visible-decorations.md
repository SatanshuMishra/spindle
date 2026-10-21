# spindle-visible-decorations: Restore the spindle desktop progress bar and rail connectors that empty-alt Svgs hid
Status: active
Updated: 2026-10-21T21:41:04.181Z
Next ids: c5 D2 R1 S1

## Goal

The desktop band's progress bar and the pane's rail connectors and lanes remainder draw again at every width, the bar never collapses when one piece is not drawn, and a test refuses any desktop Svg with an empty alt.

## Done when

- [ ] c1 No desktop band or pane Svg has an empty alt, and a test fails if one does
- [ ] c2 The spindle bar holds its own height independent of the in-bar pill
- [ ] c3 claude plugin test plugins/spindle and scripts/check.sh pass
- [ ] c4 The owner's desktop hand check shows the bar and the rail connectors

## Where things stand

Spec handed off (full pathway, unattended; spec review approved). The mitosis build of MSP visible-decorations is running in the background, logging to <home>/build-1.log.

## Next step

Run ~/.mitosis/spindle/spindle-visible-decorations/run.zsh to build MSP visible-decorations, then review round 1.

Needs: D1.

## Decisions in force

- D1 Interphase hand-off: build the visible-decorations spec as one MSP of one Step: One MSP, visible-decorations, one Step fix-visible-decorations, built by run.zsh from the FEATURE branch fix/spindle-visible-decorations.

## Open risks

## Settled, do not reopen

## Where the details live

- Cause: commit 90ff5e8 gave five decorative Svgs alt="" (band.tsx ticks, tick spacer, in-bar pill; pane.tsx rail connectors, lanes remainder); the desktop does not draw them and the bar's only in-flow height was the pill
- Prior run: spindle-native-layout (done), SatanshuMishra/spindle#12 and #13
