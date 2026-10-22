# spindle-finish-states: Spindle finish screens for every final run state, past runs and Working now by MSP
Status: active
Updated: 2026-10-22T03:53:19.847Z
Next ids: c6 D3 R2 S1

## Goal

Job 2 main part: mock up and build the band and run pane for every final lifecycle state (a celebration for a clean success, an honest finish for draft or stopped runs), keep past runs browsable, and show Working now with a Working and a Done section per MSP, per decisions Q9 to Q13 and Q18 of the spindle-run-lifecycle interview.

## Done when

- [x] c1 Every lifecycle state in docs/run-lifecycle.md has a band and run pane frame in docs/mockups/finish-states.html evidence: scripts/check-mockup.sh passes on mitosis/finish-mockup (9 states each have a band and run pane frame), and the mitosis gate showed it failing with the work reverted; pull request 24
- [x] c2 A clean success (closed-done, no draft, green lighthouse) plays a crab celebration once that settles and respects reduced motion; every other final state shows a plain, honest finish evidence: finish-facts acceptance tests (celebrated only for closed-done with a green lighthouse verdict, plain for draft, blocked, unreadable or missing verdicts, once-only and settle tests) fail reverted and pass with the work in the mitosis gate, 46 of 46; pull request 23
- [x] c3 Past runs stay browsable from a Past runs list in the run pane, read-only from the run records evidence: finish-pane and pane tests for the Past runs list and read-only past-run view pass in the finish-facts suite (263 pass) and the ship gate; pull request 23
- [x] c4 Working now shows a Working and a Done section for the selected MSP, attributing lane workers and main-thread agents to their MSP evidence: Working and Done section and MSP attribution tests pass in the finish-facts suite and gate; the event data does not record a worker's MSP, so the pipeline msp: brief line, mitosis lane.start and lane.end and a per-lane agent log must emit it; pull request 23
- [x] c5 Screenshots of the running panel in each final state are compared against the mock-up, or the comparison is listed as unproven evidence: listed as unproven: spec criterion 5.11 names the screenshot comparison unproven, and the owner stages each final state with scripts/stage-finish-fixtures.sh to compare against docs/mockups/finish-states.html

## Where things stand

Shipped: pull requests 23 (finish-facts) and 24 (finish-mockup) are open, ready for review, assigned to the owner, with their review comments, into feat/spindle-finish-states, which is a merge of Job 1's mitosis/run-record-reader and mitosis/lifecycle-table at 1666367. Both were green at round 2. The event data records no worker's MSP; the pipeline's msp: brief line, mitosis lane.start and lane.end, and a mitosis per-lane agent log are what must emit it. Unproven: the 5.11 screenshot comparison, a desktop smoke run, and a live CI run of the zsh install until pull request 24's checks finish.

## Next step

Run SHIP=1 ~/.mitosis/spindle/spindle-finish-states/run.zsh --resume --proven-head finish-facts=e156024 --proven-head finish-mockup=f50fbdd, then open both pull requests into feat/spindle-finish-states, assign them and post each saved comment.

Needs: D2, R1.

## Decisions in force

- D1 Interphase hand-off: spindle-finish-states spec approved for build: Build now: run.zsh --plan-only, then the first build from the run home ~/.mitosis/spindle/spindle-finish-states.
- D2 Ship: open finish-facts and finish-mockup as ready pull requests into feat/spindle-finish-states: Ship now with the reviewed-green heads as proven heads; mitosis gates the commits on top and pushes both MSPs, and both pull requests open ready for review into feat/spindle-finish-states.

## Open risks

- R1 Job 2's MSP pull requests target feat/spindle-finish-states, which carries Job 1's unmerged MSPs; if pull request 21 or 22 changes in review, the FEATURE branch must merge them again.

## Settled, do not reopen

## Where the details live

- Decisions: docs/specs/spindle-run-lifecycle.decisions.md (Q9 to Q13, Q18) in the spindle checkout
- Lifecycle table: docs/run-lifecycle.md on mitosis/lifecycle-table (spindle pull request 22)
- Reader it builds on: mitosis/run-record-reader (spindle pull request 21)
- Design source: ~/Documents/DevLabs/spindle-design
- Job 2 spec files: docs/specs/spindle-finish-states.{md,decisions.md,record.json,items.json} in the spindle checkout
- Run home: ~/.mitosis/spindle/spindle-finish-states (charter, run.zsh, rounds.md, build logs); run directory ~/.mitosis/runs/spindle/spindle-finish-states (lane logs)
- Review files: ~/.mitosis/spindle/spindle-finish-states/review (obligations, assumptions, proofs; round-1/ holds diffs, suite output, briefs, findings and candidates per MSP)
