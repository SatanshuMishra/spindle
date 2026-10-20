# spindle-paint-repair: Repair spindle 0.2.0's band and Pipeline pane as the desktop app actually draws them
Status: active
Updated: 2026-10-20T00:53:55.923Z
Next ids: c1 D1 R1 S1

## Goal

Make spindle's band and Pipeline pane, as the Claude desktop app really paints them, match the approved design preview and work: no explanation text drawn in place of controls, a bar that narrows without shrinking, opaque hover cards, MSP selection that follows each press, and a settled way to check the real paint before claiming done.

## Done when

## Where things stand

Not started.

## Next step

Run interphase:bug for the paint repair with an interview, starting with how the real desktop paint will be verified.

## Decisions in force

## Open risks

## Settled, do not reopen

## Where the details live

- Reported defects: owner's screenshot of 0.2.0; Button label drawn as text, bar Svg height scales with width, hover cards without background, MSP selection stuck after the first press
- Plugin: plugins/spindle (band.tsx, pane.tsx, hint.tsx under hooks/draw)
- Mod API: plugin-authoring types claude-code.d.ts (ButtonProps, BoxProps hover, SvgProps)
