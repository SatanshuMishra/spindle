# spindle-0-1: Build Spindle 0.1, the pipeline companion mod
Status: parked
Updated: 2026-10-19T17:42:11.438Z
Next ids: c5 D6 R3 S2

## Goal

Ship Spindle 0.1, a Claude Code function-hooks mod in this repository that shows a pipeline run's lane, stage, MSPs, agents and review verdicts in a band above the prompt, a run pane and toasts, read-only, through the request pipeline's full lane.

## Done when

- [x] c1 The mod passes claude plugin validate and type-checks evidence: claude plugin validate passes in scripts/check.sh and tsc 5.6.3 exits 0 at 2f60264 (review/round-6/spindle.suite.txt); the clean-checkout slow check passed, with the type-check step skipped there per R2
- [x] c2 claude plugin test covers stage inference and state.json parsing against fixtures shaped like real run homes evidence: claude plugin test passes 96 of 96 at 2f60264, including session-signals stage inference rows, run-files state.json rows and the 133-row command corpus
- [x] c3 The band and pane render against a fixture run evidence: band.test.tsx and pane.test.tsx render the band and pane against fixture runs and pass (desktop band shows slug, lane and Review R1; desktop pane at Fix shows every section)
- [x] c4 A pull request is open, opened through the pull-request skill evidence: https://github.com/SatanshuMishra/spindle/pull/1 opened through the GitHub MCP with mitosis's title and body, assigned to SatanshuMishra, review comment posted

## Where things stand

Integration done: lighthouse run 1 is green with 0 failures; the /spindle status and pane toggle paths passed 3 of 3 live trials, and the band, pane paint, toasts, live run reading and the live read-only check are unproven because a headless session draws nothing and a live run needs the off-limits run folder. The FEATURE pull request https://github.com/SatanshuMishra/spindle/pull/2 (feat/spindle-0-1 into main) is open, assigned to SatanshuMishra. Lighthouse published its profile to feat/spindle-0-1 at 91af07e. C9 keeps one atom per module because the engine refuses an atom imported from another file.

## Next step

The user starts Clean-up by saying the FEATURE pull request https://github.com/SatanshuMishra/spindle/pull/2 merged.

Needs: D2.

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
- Spec working files: docs/specs/spindle-0-1.decisions.md (binding answers) and docs/specs/spindle-0-1.record.json (seams, criteria, Steps)
- Worktree: ~/.mitosis/runs/spindle/spindle-0-1/trees/spindle (the mod's code on mitosis/spindle)
- Run home: ~/.mitosis/spindle/spindle-0-1 (CHARTER.md, run.zsh, amend-1.zsh, amend-2.zsh, rounds.md, review/ with each round's findings, verdicts and diagnoses, build logs)
- Mitosis run dirs: ~/.mitosis/runs/spindle/spindle-0-1 and ~/.mitosis/runs/spindle/spindle-0-1-amend-1 and -amend-2
- Remote: SatanshuMishra/spindle (main holds the seed commit, feat/spindle-0-1 the receipts config)
- Acceptance script: ~/.mitosis/spindle/accept.zsh (maps one plugin test to mitosis's exit codes; a missing import or export from reverted work is a failure)
- Pull request: https://github.com/SatanshuMishra/spindle/pull/1 (MSP spindle into feat/spindle-0-1, merged)
- Feature record: ~/.mitosis/spindle/spindle-0-1/feature.json (core main, FEATURE feat/spindle-0-1, remote origin)
- FEATURE pull request: https://github.com/SatanshuMishra/spindle/pull/2 (feat/spindle-0-1 into main)
- Lighthouse results: ~/.mitosis/spindle/spindle-0-1/lighthouse/run-1 (findings.json, report.md, verdict.json, evidence/)
