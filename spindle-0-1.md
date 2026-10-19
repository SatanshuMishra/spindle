# spindle-0-1: Build Spindle 0.1, the pipeline companion mod
Status: active
Updated: 2026-10-19T11:32:25.169Z
Next ids: c5 D5 R3 S2

## Goal

Ship Spindle 0.1, a Claude Code function-hooks mod in this repository that shows a pipeline run's lane, stage, MSPs, agents and review verdicts in a band above the prompt, a run pane and toasts, read-only, through the request pipeline's full lane.

## Done when

- [ ] c1 The mod passes claude plugin validate and type-checks
- [ ] c2 claude plugin test covers stage inference and state.json parsing against fixtures shaped like real run homes
- [ ] c3 The band and pane render against a fixture run
- [ ] c4 A pull request is open, opened through the pull-request skill

## Where things stand

Stage 3, round 5 of MSP spindle on branch mitosis/spindle at 1ae96ff (amendment 2 fast-forwarded in; base feat/spindle-0-1, previous head 2cf784e), 94 tests passing and tsc clean (review/round-5/spindle.suite.txt). Obligations cover criteria 5.1 to 5.19 with the Threats re-appended. The round 4 shell-oracle check now shows only the 7 expected misses plus the captured-output row the corpus marks as a run. Round 5 findings are in review/round-5/spindle.findings.json: S1 MEDIUM (a newline after && ends the list, so a multi-line && chain after pipeline clean never reaches Done) and LOW C1-C3, S2-S3; the validator is judging the 7 candidates (P1 carried, S1 new, five advisories). Fixes, pending its verdict: S1 keeps a newline after &&, || or | as a continuation; C1 backgrounds the whole and-or list; S2 ends a for header at do only as the second word or the first after ; or newline; C2 and S3 move accumulation into one named linear appender, cap substitution depth, and compute decidesStatus in one reverse pass; C3 extracts escapedEnd. C9 keeps one atom per module because the engine refuses an atom imported from another file.

## Next step

When both round 5 reviewers return, save their arrays as review/round-5/spindle.findings.json, run pipeline candidates, the validator if any, record, verdict and the rounds.md line.

Needs: D2, D3, D4.

## Decisions in force

- D2 Amendment hand-off: one MSP, spindle, instead of two stacked: One MSP, spindle, one pull request; recorded in the spec as an assumption overriding the two-PR decision and reported as a top risk.
- D3 Amendment 1 hand-off: run found by the session's thread, newest first: Amendment 1: Step second-run in MSP spindle-amend-1, built by amend-1.zsh on branch mitosis/spindle with --no-push, then merged into mitosis/spindle before round 2.
- D4 Amendment 2 hand-off: running a command bounded by bash's simple-command grammar: Amendment 2: Step command-bound in MSP spindle-amend-2, built by amend-2.zsh on branch mitosis/spindle with --no-push, merged into mitosis/spindle before review round 5 with previous head 2cf784e.

## Open risks

- R1 CI is unproven: claude plugin test on a GitHub runner without a Claude login has never run. Bears on c1.
- R2 Type-check runs only where the engine has laid its types beside the mod; check.sh skips it otherwise. Bears on c1.

## Settled, do not reopen

- S1 The visual design on the Spindle design page (band, pane, crew costumes, art style) is approved by the owner and is not an interview question.

## Where the details live

- Design: https://claude.ai/artifact/NunJteCXFLtDCAEJmGnZnS and ~/Documents/DevLabs/spindle-design/
- Reference mod: ~/Documents/DevLabs/spindle-design/claude-kit-reference/plugins/savvy-progress/hooks/register.tsx
- Shared notes: ~/Library/Application Support/Claude/side-session-notes/local_60a3e134-d8d3-492f-a0c2-70f85dbf580e
- Spec working files: docs/specs/spindle-0-1.decisions.md (binding answers) and docs/specs/spindle-0-1.record.json (seams, criteria, Steps)
- Worktree: ~/.mitosis/runs/spindle/spindle-0-1/trees/spindle (the mod's code on mitosis/spindle)
- Run home: ~/.mitosis/spindle/spindle-0-1 (CHARTER.md, run.zsh, amend-1.zsh, amend-2.zsh, rounds.md, review/ with each round's findings, verdicts and diagnoses, build logs)
- Mitosis run dirs: ~/.mitosis/runs/spindle/spindle-0-1 and ~/.mitosis/runs/spindle/spindle-0-1-amend-1 and -amend-2
- Remote: SatanshuMishra/spindle (main holds the seed commit, feat/spindle-0-1 the receipts config)
- Acceptance script: ~/.mitosis/spindle/accept.zsh (maps one plugin test to mitosis's exit codes; a missing import or export from reverted work is a failure)
