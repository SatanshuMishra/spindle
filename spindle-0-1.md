# spindle-0-1: Build Spindle 0.1, the pipeline companion mod
Status: parked
Updated: 2026-10-19T17:43:27.045Z
Next ids: c5 D6 R3 S2

## Goal

Ship Spindle 0.1, a Claude Code function-hooks mod in this repository that shows a pipeline run's lane, stage, MSPs, agents and review verdicts in a band above the prompt, a run pane and toasts, read-only, through the request pipeline's full lane.

## Done when

- [x] c1 The mod passes claude plugin validate and type-checks evidence: claude plugin validate passes in scripts/check.sh and tsc 5.6.3 exits 0 at 2f60264 (review/round-6/spindle.suite.txt); the clean-checkout slow check passed, with the type-check step skipped there per R2
- [x] c2 claude plugin test covers stage inference and state.json parsing against fixtures shaped like real run homes evidence: claude plugin test passes 96 of 96 at 2f60264, including session-signals stage inference rows, run-files state.json rows and the 133-row command corpus
- [x] c3 The band and pane render against a fixture run evidence: band.test.tsx and pane.test.tsx render the band and pane against fixture runs and pass (desktop band shows slug, lane and Review R1; desktop pane at Fix shows every section)
- [x] c4 A pull request is open, opened through the pull-request skill evidence: https://github.com/SatanshuMishra/spindle/pull/1 opened through the GitHub MCP with mitosis's title and body, assigned to SatanshuMishra, review comment posted

## Where things stand

Done: PR #1 and FEATURE pull request #2 are merged into main at 090e160, and pipeline clean removed the run's worktrees, branches, run folders and spec files, keeping nothing. Lighthouse left the live band, pane paint, toasts and real-run reading unproven.

## Next step

None: the thread is closed.

## Decisions in force

- D2 Amendment hand-off: one MSP, spindle, instead of two stacked: One MSP, spindle, one pull request; recorded in the spec as an assumption overriding the two-PR decision and reported as a top risk.

## Open risks

- R1 CI is unproven: claude plugin test on a GitHub runner without a Claude login has never run. Bears on c1.
- R2 Type-check runs only where the engine has laid its types beside the mod; check.sh skips it otherwise. Bears on c1.

## Settled, do not reopen

- S1 The visual design on the Spindle design page (band, pane, crew costumes, art style) is approved by the owner and is not an interview question.

## Where the details live

- Design: https://claude.ai/artifact/NunJteCXFLtDCAEJmGnZnS and ~/Documents/DevLabs/spindle-design/
- Reference mod: ~/Documents/DevLabs/spindle-design/claude-kit-reference/plugins/savvy-progress/hooks/register.tsx
- Shared notes: ~/Library/Application Support/Claude/side-session-notes/local_60a3e134-d8d3-492f-a0c2-70f85dbf580e
- Remote: SatanshuMishra/spindle (main holds Spindle 0.1, GLOSSARY.md and docs/adr)
- Pull request: https://github.com/SatanshuMishra/spindle/pull/1 (MSP spindle into feat/spindle-0-1, merged)
- FEATURE pull request: https://github.com/SatanshuMishra/spindle/pull/2 (feat/spindle-0-1 into main, merged)
- Repository pipeline files: ~/.mitosis/spindle/ (accept.zsh, the findings ledger findings.jsonl), kept for later runs
