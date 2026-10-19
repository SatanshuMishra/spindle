# spindle-0-1: Build Spindle 0.1, the pipeline companion mod
Status: active
Updated: 2026-10-19T08:33:19.209Z
Next ids: c5 D3 R3 S2

## Goal

Ship Spindle 0.1, a Claude Code function-hooks mod in this repository that shows a pipeline run's lane, stage, MSPs, agents and review verdicts in a band above the prompt, a run pane and toasts, read-only, through the request pipeline's full lane.

## Done when

- [ ] c1 The mod passes claude plugin validate and type-checks
- [ ] c2 claude plugin test covers stage inference and state.json parsing against fixtures shaped like real run homes
- [ ] c3 The band and pane render against a fixture run
- [ ] c4 A pull request is open, opened through the pull-request skill

## Where things stand

Pipeline stage 2, first mitosis build running in the background (log ~/.mitosis/spindle/spindle-0-1/build-1.log). The spec is handed off after its one review. The public remote SatanshuMishra/spindle exists, main holds the seed commit, and feat/spindle-0-1 holds the receipts config. The run home ~/.mitosis/spindle/spindle-0-1 holds CHARTER.md, run.zsh, dispatch.zsh, worker-rules.txt, items.json and receipts-answers.json. Run dir: ~/.mitosis/runs/spindle/spindle-0-1. Pipeline anchor: spindle-0-1 at /Users/satanshumishra/.mitosis/spindle/spindle-0-1, thread spindle-0-1: /Users/satanshumishra/.mitosis/spindle/spindle-0-1/run.zsh --plan-only

## Next step

When the build exits, read mitosis's last stdout line in build-1.log, then start stage 3 round 1 for MSP spindle: diff, obligations, suite, code-reviewer, conformance-auditor and security-reviewer (the mod parses untrusted files and draws their text into Svg).

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
