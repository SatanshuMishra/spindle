# spindle-0-1: Build Spindle 0.1, the pipeline companion mod
Status: active
Updated: 2026-10-19T11:08:33.877Z
Next ids: c5 D5 R3 S2

## Goal

Ship Spindle 0.1, a Claude Code function-hooks mod in this repository that shows a pipeline run's lane, stage, MSPs, agents and review verdicts in a band above the prompt, a run pane and toasts, read-only, through the request pipeline's full lane.

## Done when

- [ ] c1 The mod passes claude plugin validate and type-checks
- [ ] c2 claude plugin test covers stage inference and state.json parsing against fixtures shaped like real run homes
- [ ] c3 The band and pane render against a fixture run
- [ ] c4 A pull request is open, opened through the pull-request skill

## Where things stand

Stage 3 of MSP spindle on branch mitosis/spindle at 0f76302 (base feat/spindle-0-1), 89 tests passing. Round 4 verdict is loop: its blocker C1 (narrow command match) was diagnosed requirement-wrong, so amendment 2 (D4) is being built by mitosis from amend-2.zsh (plan 6a2685d863d8, log amend-2-build.log). The Threats section of the obligations file is saved at review/spindle.threats.md for re-appending after obligations are regenerated with criteria 5.1 to 5.19. C9 keeps one atom per module because the engine refuses an atom imported from another file.

## Next step

When the amendment 2 build finishes, read its JSON result, merge its branch into mitosis/spindle, re-run pipeline obligations with criteria plus 5.11 and 5.19, append the Threats again, and start review round 5 with previous head 2cf784e.

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
