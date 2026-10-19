# Spindle

Spindle is a Claude Code mod that shows what a request-pipeline run is doing: its lane, stage and review round, the MSPs mitosis is building with their acceptance proof, the agents at work and each round's verdict. It draws a band above the prompt, a run pane and toasts, read from the run's files and the session's own events, and it writes nothing.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install spindle --marketplace SatanshuMishra/spindle
```

From a shell:

```
claude plugin install spindle --marketplace SatanshuMishra/spindle
```

To load a clone by hand for one session:

```
claude --plugin-dir <clone>/plugins/spindle
```

## Use

- `/spindle` shows or hides the run pane.
- `/spindle status` prints the run as text lines in the transcript.

## Checks

```
scripts/check.sh
```

It runs `claude plugin validate --strict` on the marketplace and on the mod, `claude plugin test plugins/spindle`, and `tsc -p plugins/spindle` once the engine has laid its types in `plugins/spindle/.claude-plugin/types` (it says the type-check was skipped otherwise). CI runs the same script on every push and pull request.

## Layout

```
.claude-plugin/marketplace.json   the marketplace, listing the one plugin
plugins/spindle/
  .claude-plugin/plugin.json      the mod's manifest
  hooks/hooks.json                names the hooks module
  hooks/register.tsx              wires the hooks
  hooks/run/                      reads the run's files and the session's events into the run view
  hooks/draw/                     draws the band, the run pane and the crew
  types/index.d.ts                the $.state contract
  tests/                          the harness, fixture run homes and the plugin tests
scripts/check.sh                  the repository checks
.github/workflows/check.yml       CI
```

## License

MIT, see LICENSE. The pixel crab art, costumes and motion derive from the savvy-progress plugin of claude-kit (https://github.com/johnnyvizz/claude-kit), used under the MIT License, Copyright (c) 2026 johnnyvizz.
