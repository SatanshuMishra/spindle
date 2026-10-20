# The stage follows the slowest MSP

The run's stage is the earliest stage any MSP without a pull request is at, and Ship once every MSP is green, blocked or has a pull request; Integrate and Clean-up still come from the run-wide signals. The stage is derived afresh from the MSPs on every refresh rather than held forward, because a run-wide stage that only moved forward showed Ship for hours while one MSP was still in review: a ship call or one pushed MSP must not hide another MSP's unfinished rounds.

Each MSP's own activity (Build, a round, a fix or Ship) carries the detail a single run-wide stage cannot, so the band and pane name what every MSP is doing and the stage only summarises the slowest of them.

Status: accepted
