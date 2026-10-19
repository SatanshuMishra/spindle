# spindle-0-1: Build Spindle 0.1, the pipeline companion mod
Status: active
Updated: 2026-10-19T08:30:21.189Z
Next ids: c5 D2 R1 S2

## Goal

Ship Spindle 0.1, a Claude Code function-hooks mod in this repository that shows a pipeline run's lane, stage, MSPs, agents and review verdicts in a band above the prompt, a run pane and toasts, read-only, through the request pipeline's full lane.

## Done when

- [ ] c1 The mod passes claude plugin validate and type-checks
- [ ] c2 claude plugin test covers stage inference and state.json parsing against fixtures shaped like real run homes
- [ ] c3 The band and pane render against a fixture run
- [ ] c4 A pull request is open, opened through the pull-request skill

## Where things stand

The owner approved the read-back on 2026-10-19; the run is autonomous from here. Interphase phase 8 is done: the six Step tasks are written, the spec and items file rendered, and check_record, check_spec and check_items pass. Phase 9's single spec review is next.

## Next step

Dispatch interphase:spec-reviewer once (unattended), fix what would build the wrong thing, re-render and re-check, then phase 10 (glossary, ADR, tree_guard verify, record handed-off). Then pipeline stage 2: create the public SatanshuMishra/spindle remote, seed main (LICENSE, .gitignore, README stub), cut the FEATURE branch, save the receipts answers drafted in /var/folders/tz/b798spt96sjfyy924nf0cw4c0000gn/T/tmp.PlNLOGEUst as <home>/receipts-answers.json, write the run home files and build.

## Decisions in force

- D1 Interphase hand-off: build spindle-0-1 as two stacked MSPs: Build now: run --plan-only, then the first build on feat/spindle-0-1 with the run home ~/.mitosis/spindle/spindle-0-1.

## Open risks

## Settled, do not reopen

- S1 The visual design on the Spindle design page (band, pane, crew costumes, art style) is approved by the owner and is not an interview question.

## Where the details live

- Design: https://claude.ai/artifact/NunJteCXFLtDCAEJmGnZnS and ~/Documents/DevLabs/spindle-design/
- Reference mod: ~/Documents/DevLabs/spindle-design/claude-kit-reference/plugins/savvy-progress/hooks/register.tsx
- Shared notes: ~/Library/Application Support/Claude/side-session-notes/local_60a3e134-d8d3-492f-a0c2-70f85dbf580e
- Spec working files: docs/specs/spindle-0-1.decisions.md (binding answers) and docs/specs/spindle-0-1.record.json (seams, criteria, Steps)
