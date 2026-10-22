# spindle-finish-states: Spindle finish screens for every final run state, past runs and Working now by MSP
Status: active
Updated: 2026-10-22T02:05:25.662Z
Next ids: c6 D1 R2 S1

## Goal

Job 2 main part: mock up and build the band and run pane for every final lifecycle state (a celebration for a clean success, an honest finish for draft or stopped runs), keep past runs browsable, and show Working now with a Working and a Done section per MSP, per decisions Q9 to Q13 and Q18 of the spindle-run-lifecycle interview.

## Done when

- [ ] c1 Every lifecycle state in docs/run-lifecycle.md has a band and run pane frame in docs/mockups/finish-states.html
- [ ] c2 A clean success (closed-done, no draft, green lighthouse) plays a crab celebration once that settles and respects reduced motion; every other final state shows a plain, honest finish
- [ ] c3 Past runs stay browsable from a Past runs list in the run pane, read-only from the run records
- [ ] c4 Working now shows a Working and a Done section for the selected MSP, attributing lane workers and main-thread agents to their MSP
- [ ] c5 Screenshots of the running panel in each final state are compared against the mock-up, or the comparison is listed as unproven

## Where things stand

FEATURE branch feat/spindle-finish-states is pushed at 1666367, a merge of mitosis/run-record-reader and mitosis/lifecycle-table, because Job 1's FEATURE branch holds none of their code until pull requests 21 and 22 merge; the run home's feature.json records it and pipeline feature-branch adopted it.

## Next step

Run interphase:feature autonomously from decisions Q9 to Q13 and Q18 in docs/specs/spindle-run-lifecycle.decisions.md.

## Decisions in force

## Open risks

- R1 Job 2's MSP pull requests target feat/spindle-finish-states, which carries Job 1's unmerged MSPs; if pull request 21 or 22 changes in review, the FEATURE branch must merge them again.

## Settled, do not reopen

## Where the details live

- Decisions: docs/specs/spindle-run-lifecycle.decisions.md (Q9 to Q13, Q18) in the spindle checkout
- Lifecycle table: docs/run-lifecycle.md on mitosis/lifecycle-table (spindle pull request 22)
- Reader it builds on: mitosis/run-record-reader (spindle pull request 21)
- Design source: ~/Documents/DevLabs/spindle-design
