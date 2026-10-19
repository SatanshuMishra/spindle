# spindle-0-1: Build Spindle 0.1, the pipeline companion mod
Status: active
Updated: 2026-10-19T09:41:38.627Z
Next ids: c5 D4 R3 S2

## Goal

Ship Spindle 0.1, a Claude Code function-hooks mod in this repository that shows a pipeline run's lane, stage, MSPs, agents and review verdicts in a band above the prompt, a run pane and toasts, read-only, through the request pipeline's full lane.

## Done when

- [ ] c1 The mod passes claude plugin validate and type-checks
- [ ] c2 claude plugin test covers stage inference and state.json parsing against fixtures shaped like real run homes
- [ ] c3 The band and pane render against a fixture run
- [ ] c4 A pull request is open, opened through the pull-request skill

## Where things stand

Pipeline stage 3, round 1 fix pass for MSP spindle in worktree ~/.mitosis/runs/spindle/spindle-0-1/trees/spindle (branch mitosis/spindle, base feat/spindle-0-1, first build head 1e8876c). Fixed with receipt tests: C1, C2, C5, C4, S2, C6, C7, C9 (C9 keeps one atom per module, since the engine refuses an atom imported from another file); 65 tests pass, tsc and validate clean. C3 was requirement-wrong: amendment 1 (Step second-run, MSP spindle-amend-1, items docs/specs/spindle-0-1.amend-1.items.json) is building in the background (log ~/.mitosis/spindle/spindle-0-1/amend-1-build.log, run dir ~/.mitosis/runs/spindle/spindle-0-1-amend-1). The public remote SatanshuMishra/spindle exists, main holds the seed commit, and feat/spindle-0-1 holds the receipts config. The run home ~/.mitosis/spindle/spindle-0-1 holds CHARTER.md, run.zsh, dispatch.zsh, worker-rules.txt, items.json and receipts-answers.json. Run dir: ~/.mitosis/runs/spindle/spindle-0-1. Pipeline anchor: spindle-0-1 at /Users/satanshumishra/.mitosis/spindle/spindle-0-1, thread spindle-0-1: /Users/satanshumishra/.mitosis/spindle/spindle-0-1/run.zsh --plan-only

## Next step

Run ~/.mitosis/spindle/spindle-0-1/amend-1.zsh --plan-only, then build it, merge its branch into mitosis/spindle in the worktree, re-run pipeline obligations with criteria plus 5.4 and 5.9, then start review round 2 for MSP spindle.

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
