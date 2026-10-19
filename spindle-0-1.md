# spindle-0-1: Build Spindle 0.1, the pipeline companion mod
Status: active
Updated: 2026-10-19T07:56:02.962Z
Next ids: c5 D1 R1 S2

## Goal

Ship Spindle 0.1, a Claude Code function-hooks mod in this repository that shows a pipeline run's lane, stage, MSPs, agents and review verdicts in a band above the prompt, a run pane and toasts, read-only, through the request pipeline's full lane.

## Done when

- [ ] c1 The mod passes claude plugin validate and type-checks
- [ ] c2 claude plugin test covers stage inference and state.json parsing against fixtures shaped like real run homes
- [ ] c3 The band and pane render against a fixture run
- [ ] c4 A pull request is open, opened through the pull-request skill

## Where things stand

Interphase interview under way, slug spindle-0-1: intent and round 1 are answered and recorded; the record holds 2 seams, 18 criteria and 6 Steps and passes check_record. Round 2 (Q26: two stacked pull requests, run-data then run-ui) awaits the owner.

## Next step

Record the Q26 answer as each Step's msp, run check_record --complete, then hold the phase 7 read-back with AskUserQuestion. After approval: create the public SatanshuMishra/spindle remote, seed main (LICENSE, .gitignore, README stub), and continue phases 8-10. Receipts answers are drafted in /var/folders/tz/b798spt96sjfyy924nf0cw4c0000gn/T/tmp.PlNLOGEUst; save them as <home>/receipts-answers.json once the run home exists.

## Decisions in force

## Open risks

## Settled, do not reopen

- S1 The visual design on the Spindle design page (band, pane, crew costumes, art style) is approved by the owner and is not an interview question.

## Where the details live

- Design: https://claude.ai/artifact/NunJteCXFLtDCAEJmGnZnS and ~/Documents/DevLabs/spindle-design/
- Reference mod: ~/Documents/DevLabs/spindle-design/claude-kit-reference/plugins/savvy-progress/hooks/register.tsx
- Shared notes: ~/Library/Application Support/Claude/side-session-notes/local_60a3e134-d8d3-492f-a0c2-70f85dbf580e
- Spec working files: docs/specs/spindle-0-1.decisions.md (binding answers) and docs/specs/spindle-0-1.record.json (seams, criteria, Steps)
