# spindle-paint-repair: Repair spindle 0.2.0's band and Pipeline pane as the desktop app actually draws them
Status: active
Updated: 2026-10-20T01:37:37.785Z
Next ids: c1 D2 R3 S1

## Goal

Make spindle's band and Pipeline pane, as the Claude desktop app really paints them, match the approved design preview and work: no explanation text drawn in place of controls, a bar that narrows without shrinking, opaque hover cards, MSP selection that follows each press, and a settled way to check the real paint before claiming done.

## Done when

## Where things stand

Release 0.2.1 is installed. Release 0.2.2 (white card text on a fixed dark card, no card on the crab, a "Copied" card after pressing the thread name) waits for the owner's merge in SatanshuMishra/spindle#11, from fix/spindle-band-touchups in worktree ~/.mitosis/runs/spindle/paint-touchups, with 159 tests passing.

## Next step

After the owner merges SatanshuMishra/spindle#11, fast-forward main, update spindle, remove the branch and worktree, and have the owner check the pane's real paint, including R1 and R2.

## Decisions in force

- D1 Work without the pipeline: the owner asked for fast autonomous work from the approved preview, so the fix went directly on a branch with no interview, spec or review agents.

## Open risks

- R1 The desktop may draw a Button's hotkey itself, which would show the MSP digit twice.
- R2 The desktop's handling of Text styling inside Buttons and of Svg pictures without a width prop is inferred from the API docs, not seen.

## Settled, do not reopen

## Where the details live

- Reported defects: owner's screenshot of 0.2.0; Button label drawn as text, bar Svg height scales with width, hover cards without background, MSP selection stuck after the first press
- Plugin: plugins/spindle (band.tsx, pane.tsx, hint.tsx, text.ts under hooks/draw)
- Mod API: plugin-authoring types claude-code.d.ts (ButtonProps, BoxProps hover, SvgProps)
- Approved preview: session scratchpad spindle-preview-2.html; paint stand-in at scratchpad paint/index.html with redump.sh
