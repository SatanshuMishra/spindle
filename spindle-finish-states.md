# spindle-finish-states: Spindle finish screens for every final run state, past runs and Working now by MSP
Status: active
Updated: 2026-10-22T03:30:43.421Z
Next ids: c6 D2 R2 S1

## Goal

Job 2 main part: mock up and build the band and run pane for every final lifecycle state (a celebration for a clean success, an honest finish for draft or stopped runs), keep past runs browsable, and show Working now with a Working and a Done section per MSP, per decisions Q9 to Q13 and Q18 of the spindle-run-lifecycle interview.

## Done when

- [ ] c1 Every lifecycle state in docs/run-lifecycle.md has a band and run pane frame in docs/mockups/finish-states.html
- [ ] c2 A clean success (closed-done, no draft, green lighthouse) plays a crab celebration once that settles and respects reduced motion; every other final state shows a plain, honest finish
- [ ] c3 Past runs stay browsable from a Past runs list in the run pane, read-only from the run records
- [ ] c4 Working now shows a Working and a Done section for the selected MSP, attributing lane workers and main-thread agents to their MSP
- [ ] c5 Screenshots of the running panel in each final state are compared against the mock-up, or the comparison is listed as unproven

## Where things stand

FEATURE branch feat/spindle-finish-states is pushed at 1666367, a merge of mitosis/run-record-reader and mitosis/lifecycle-table, because Job 1's FEATURE branch holds none of their code until pull requests 21 and 22 merge; the run home's feature.json records it and pipeline feature-branch adopted it. The spec is handed off (7 Steps, 11 criteria, 5.11 screenshots unproven, review issues fixed). The event data records no worker's MSP; the pipeline's msp: brief line, mitosis lane.start and lane.end, and a mitosis per-lane agent log are what must emit it. Both MSPs are built and gated (finish-facts on mitosis/finish-facts, finish-mockup on mitosis/finish-mockup); both conformance audits found nothing (5.1 to 5.10 met, 5.11 unproven). Round 1 was loop for both; every blocker and advisory is fixed with receipts green and selecting checks empty. Round 2 review is running: code reviewers on finish-facts at e156024 (suite 263 pass) and finish-mockup at f50fbdd (check.sh exit 0), and a security reviewer on finish-mockup for the changed staging guard. finish-mockup's pull request must name .github/workflows/check.yml and scripts/check-staging-guard.sh under risk, as files no Step owned.

## Next step

Finish the fix pass on both MSP branches (class-wide fix, receipt green, selecting check empty, advisories), then run round 2 review on each.

Needs: D1, R1.

## Decisions in force

- D1 Interphase hand-off: spindle-finish-states spec approved for build: Build now: run.zsh --plan-only, then the first build from the run home ~/.mitosis/spindle/spindle-finish-states.

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
