# spindle-0-1: Build Spindle 0.1, the pipeline companion mod
Status: active
Updated: 2026-10-19T11:52:58.853Z
Next ids: c5 D6 R3 S2

## Goal

Ship Spindle 0.1, a Claude Code function-hooks mod in this repository that shows a pipeline run's lane, stage, MSPs, agents and review verdicts in a band above the prompt, a run pane and toasts, read-only, through the request pipeline's full lane.

## Done when

- [x] c1 The mod passes claude plugin validate and type-checks evidence: claude plugin validate passes in scripts/check.sh and tsc 5.6.3 exits 0 at 2f60264 (review/round-6/spindle.suite.txt); the clean-checkout slow check passed, with the type-check step skipped there per R2
- [x] c2 claude plugin test covers stage inference and state.json parsing against fixtures shaped like real run homes evidence: claude plugin test passes 96 of 96 at 2f60264, including session-signals stage inference rows, run-files state.json rows and the 133-row command corpus
- [x] c3 The band and pane render against a fixture run evidence: band.test.tsx and pane.test.tsx render the band and pane against fixture runs and pass (desktop band shows slug, lane and Review R1; desktop pane at Fix shows every section)
- [x] c4 A pull request is open, opened through the pull-request skill evidence: https://github.com/SatanshuMishra/spindle/pull/1 opened through the GitHub MCP with mitosis's title and body, assigned to SatanshuMishra, review comment posted

## Where things stand

Shipped: MSP spindle is pushed on mitosis/spindle at 2f60264 (review round 6 green, every advisory fixed, slow check proven in review/spindle.proofs.jsonl) and open as https://github.com/SatanshuMishra/spindle/pull/1 against feat/spindle-0-1, assigned to the owner with review/spindle.comment.md posted. Ship reconcile listed 8 undeclared writes (glossary, ADRs 0001 to 0004, command.ts, state.ts, command-corpus.test.ts), expected from the docs commit and the amendments. The pull request body repeats one What changed bullet six times as mitosis wrote it. C9 keeps one atom per module because the engine refuses an atom imported from another file.

## Next step

Run SHIP=1 ~/.mitosis/spindle/spindle-0-1/run.zsh --resume --proven-head spindle=<full sha of 2f60264>, read its JSON result, open the pull request with create_pull_request using mitosis's title and body, assign the owner, post review/spindle.comment.md, park the thread and report to the parent session.

Needs: D2, D5.

## Decisions in force

- D2 Amendment hand-off: one MSP, spindle, instead of two stacked: One MSP, spindle, one pull request; recorded in the spec as an assumption overriding the two-PR decision and reported as a top risk.
- D3 Amendment 1 hand-off: run found by the session's thread, newest first: Amendment 1: Step second-run in MSP spindle-amend-1, built by amend-1.zsh on branch mitosis/spindle with --no-push, then merged into mitosis/spindle before round 2.
- D4 Amendment 2 hand-off: running a command bounded by bash's simple-command grammar: Amendment 2: Step command-bound in MSP spindle-amend-2, built by amend-2.zsh on branch mitosis/spindle with --no-push, merged into mitosis/spindle before review round 5 with previous head 2cf784e.
- D5 Ship boundary: MSP spindle ships from proven head 2f60264: Ship MSP spindle from proven head 2f60264 with SHIP=1 run.zsh --resume, then open its pull request through the GitHub MCP with mitosis's title and body, assign the owner, and post the saved comment.

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
- Pull request: https://github.com/SatanshuMishra/spindle/pull/1 (MSP spindle into feat/spindle-0-1)
