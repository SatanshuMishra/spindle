# spindle-0-1: Build Spindle 0.1, the pipeline companion mod
Status: active
Updated: 2026-10-19T07:12:46.590Z
Next ids: c5 D1 R1 S2

## Goal

Ship Spindle 0.1, a Claude Code function-hooks mod in this repository that shows a pipeline run's lane, stage, MSPs, agents and review verdicts in a band above the prompt, a run pane and toasts, read-only, through the request pipeline's full lane.

## Done when

- [ ] c1 The mod passes claude plugin validate and type-checks
- [ ] c2 claude plugin test covers stage inference and state.json parsing against fixtures shaped like real run homes
- [ ] c3 The band and pane render against a fixture run
- [ ] c4 A pull request is open, opened through the pull-request skill

## Where things stand

Interphase interview under way on the project pathway, slug spindle-0-1: the intent round is asked and awaits the owner's answer. Lighthouse readiness reports no profile; receipts is not configured.

## Next step

Record the owner's intent answers in docs/specs/spindle-0-1.decisions.md, then ask the frontier round: stage-inference mapping, cost scope, resumed-session behaviour, fixtures, licence, CI, and creating the GitHub remote. Receipts answers are drafted in /var/folders/tz/b798spt96sjfyy924nf0cw4c0000gn/T/tmp.PlNLOGEUst; save them as <home>/receipts-answers.json once the run home exists.

## Decisions in force

## Open risks

## Settled, do not reopen

- S1 The visual design on the Spindle design page (band, pane, crew costumes, art style) is approved by the owner and is not an interview question.

## Where the details live

- Design: https://claude.ai/artifact/NunJteCXFLtDCAEJmGnZnS and ~/Documents/DevLabs/spindle-design/
- Reference mod: ~/Documents/DevLabs/spindle-design/claude-kit-reference/plugins/savvy-progress/hooks/register.tsx
- Shared notes: ~/Library/Application Support/Claude/side-session-notes/local_60a3e134-d8d3-492f-a0c2-70f85dbf580e
- Spec working files: docs/specs/spindle-0-1.decisions.md (binding answers) and docs/specs/spindle-0-1.record.json (seams, criteria, Steps)
