# spindle-0-1: Build Spindle 0.1, the pipeline companion mod
Status: active
Updated: 2026-10-19T09:56:24.401Z
Next ids: c5 D4 R3 S2

## Goal

Ship Spindle 0.1, a Claude Code function-hooks mod in this repository that shows a pipeline run's lane, stage, MSPs, agents and review verdicts in a band above the prompt, a run pane and toasts, read-only, through the request pipeline's full lane.

## Done when

- [ ] c1 The mod passes claude plugin validate and type-checks
- [ ] c2 claude plugin test covers stage inference and state.json parsing against fixtures shaped like real run homes
- [ ] c3 The band and pane render against a fixture run
- [ ] c4 A pull request is open, opened through the pull-request skill

## Where things stand

Stage 3, review round 2 for MSP spindle on branch mitosis/spindle at d6fe881 (base feat/spindle-0-1, round 1 head 1e8876c). Every round 1 blocker and advisory is fixed with a receipt test, C3 through amendment 1, fast-forwarded in; C9 keeps one atom per module because the engine refuses an atom imported from another file. Amendment 1's mitosis gate read inconclusive because accept.zsh mapped a missing export as exit 2; the script now maps it to 1, and a manual re-run of its five properties is red with the work reverted and green with it.

## Next step

When the round 2 validator returns, save its array as review/round-2/spindle.verdicts.json, then pipeline record and verdict for round 2. Round 2 findings (review/round-2/spindle.findings.json): C1 and S1 MEDIUM heredoc and comment lines read as commands, M1 HIGH amendment gate inconclusive (evidence review/amend-1.gate-rerun.txt), advisories C2, C3, C4, S2.

Needs: D2, D3.

## Decisions in force

- D2 Amendment hand-off: one MSP, spindle, instead of two stacked: One MSP, spindle, one pull request; recorded in the spec as an assumption overriding the two-PR decision and reported as a top risk.
- D3 Amendment 1 hand-off: run found by the session's thread, newest first: Amendment 1: Step second-run in MSP spindle-amend-1, built by amend-1.zsh on branch mitosis/spindle with --no-push, then merged into mitosis/spindle before round 2.

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
- Run home: ~/.mitosis/spindle/spindle-0-1 (CHARTER.md, run.zsh, amend-1.zsh, rounds.md, review/ with each round's findings, verdicts and diagnoses, build logs)
- Mitosis run dirs: ~/.mitosis/runs/spindle/spindle-0-1 and ~/.mitosis/runs/spindle/spindle-0-1-amend-1
- Remote: SatanshuMishra/spindle (main holds the seed commit, feat/spindle-0-1 the receipts config)
