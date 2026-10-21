# Desktop drawings leave sizing to the surface

On the desktop surface the band and the run pane take every width from the surface's flex layout: anything that stretches is a Box, Svgs keep fixed pixel sizes, and no width, drawing or cut text is derived from `bodyColumns`. `bodyColumns` is a count of code-font cells reported only after a resize settles, so pixel geometry built from it in the hook drew bars and rows short of the real slot and lagged every resize by a settle and a worker round trip. The one layout choice left to `bodyColumns` is coarse (the band's bar giving way to the pill below 60, the rail naming every stage from 60), and text is truncated by the surface.

Status: accepted

## Consequences

The tests cannot see the desktop paint, so whether the surface draws a tree as intended is checked by hand in the desktop app; the tree-level tests assert that nothing on desktop varies with `bodyColumns`.
