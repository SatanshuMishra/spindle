#!/usr/bin/env zsh
set -euo pipefail
setopt extended_glob

FINAL_STATES=(closed-done closed-done-plain closed-draft stopped-critical superseded cleaned abandoned unknown)
SHIPPED_STATES=(closed-done closed-done-plain closed-draft cleaned unknown)
MSPS=(limiter-core redis-store headers-docs)

usage() {
  print -u2 "usage: stage-finish-fixtures.sh <session id> <state>"
  print -u2 "  state: ${(j:, :)FINAL_STATES}"
  exit 64
}

(( $# == 2 )) || usage
session_id=$1
state=$2
(( ${FINAL_STATES[(Ie)$state]} )) || usage
if [[ $session_id != [A-Za-z0-9_-][A-Za-z0-9._-]# ]]; then
  print -u2 "stage-finish-fixtures: a session id holds only letters, digits, dot, dash and underscore"
  exit 64
fi

repo_root=${0:A:h:h}
mitosis=$HOME/.mitosis
fixture=$mitosis/spindle-fixture
slug=$state-run
home=$fixture/$slug
record=$fixture/records/$slug
events=$fixture/events/$slug.jsonl
session_file=$mitosis/sessions/$session_id.json
anchor="Pipeline anchor: $slug at $home, thread $slug: fixture"

is_staged_session() {
  perl -MJSON::PP -0777 -e '
    my ($fixture, $path, @slugs) = @ARGV;
    open my $in, "<", $path or exit 1;
    my $session = eval { JSON::PP->new->decode(scalar <$in>) } or exit 1;
    ref $session eq "HASH" && ref $session->{run_homes} eq "ARRAY" && @{ $session->{run_homes} } or exit 1;
    defined $session->{thread_id} && !ref $session->{thread_id} && grep { $_ eq $session->{thread_id} } @slugs or exit 1;
    for my $entry (@{ $session->{run_homes} }) {
      ref $entry eq "HASH" && defined $entry->{path} && !ref $entry->{path} or exit 1;
      index($entry->{path}, "$fixture/") == 0 && $entry->{path} !~ m{/\.\.(/|$)} or exit 1;
    }
    exit 0;
  ' -- $fixture $session_file ${FINAL_STATES/%/-run}
}

if [[ -L $session_file ]] || { [[ -e $session_file ]] && ! is_staged_session; }; then
  print -u2 "stage-finish-fixtures: refusing to overwrite $session_file: this script did not stage it"
  exit 2
fi

minutes_ago() { date -u -v-${1}M +%Y-%m-%dT%H:%M:%SZ }

is_shipped() { (( ${SHIPPED_STATES[(Ie)$state]} )) }

blockers_for() { [[ $1 == green ]] && print 0 || print 1 }

kept_count() { [[ $state == cleaned ]] && print 1 || print 0 }

verdict_of() {
  local msp=$1 round=$2
  if [[ $state == closed-draft && $msp == redis-store && $round == 2 ]]; then
    print blocked
  elif [[ $msp == limiter-core && $round == 1 ]] || [[ $state == closed-draft && $msp == redis-store ]]; then
    print loop
  else
    print green
  fi
}

rounds_of() {
  local msp=$1
  if is_shipped && [[ $msp == limiter-core || ( $state == closed-draft && $msp == redis-store ) ]]; then
    print 1 2
  else
    print 1
  fi
}

write_verdict() {
  local msp=$1 round=$2 outcome=$3 blockers='[]'
  [[ $outcome == green ]] || blockers='["window resets one request early"]'
  mkdir -p $record/home/review/round-$round
  print -r -- "{\"outcome\": \"$outcome\", \"round\": $round, \"blockers\": $blockers, \"advisories\": [], \"diagnose\": [], \"blocked\": []}" \
    > $record/home/review/round-$round/$msp.verdict.json
}

event() {
  local ago=$1 ev=$2 fields=${3:-}
  print -r -- "{\"v\": 1, \"ev\": \"$ev\", \"ts\": \"$(minutes_ago $ago)\", \"run\": \"spindle-fixture/$slug\", \"src\": \"pipeline\"${fields:+, $fields}}"
}

pull_request_of() {
  local index=$1
  is_shipped && print "#$(( 40 + index ))" || print ''
}

ship_of() {
  local msp=$1 index=$2 pull_request
  pull_request=$(pull_request_of $index)
  local pushed=null
  [[ -n $pull_request ]] && pushed="\"4b825dc642cb6eb9a060e54bf8d69288fbee490$index\""
  print -r -- "{\"base\": \"main\", \"branch\": \"mitosis/$msp\", \"pull_request\": \"$pull_request\", \"pushed\": $pushed, \"remote\": \"origin\", \"unchanged\": false}"
}

rm -rf -- $record
rm -f -- $events
mkdir -p $record/home $record/run ${events:h} ${session_file:h}

print -r -- "# Charter: $slug

A fixture run staged by scripts/stage-finish-fixtures.sh so spindle draws the $state finish." > $record/home/CHARTER.md

{
  print -r -- "# Rounds of $slug"
  for msp in $MSPS; do
    for round in ${=$(rounds_of $msp)}; do
      print -r -- "- round $round $msp: $(verdict_of $msp $round)"
    done
  done
} > $record/home/rounds.md

for msp in $MSPS; do
  for round in ${=$(rounds_of $msp)}; do
    write_verdict $msp $round $(verdict_of $msp $round)
  done
done

case $state in
  closed-done) lighthouse=green ;;
  closed-done-plain) lighthouse=failures ;;
  *) lighthouse= ;;
esac
if [[ -n $lighthouse ]]; then
  mkdir -p $record/home/lighthouse/run-1
  print -r -- "{\"verdict\": \"$lighthouse\", \"failures\": [], \"unproven\": [], \"flaky\": [], \"tokens\": 0, \"minutes\": 7, \"pr\": \"\"}" \
    > $record/home/lighthouse/run-1/verdict.json
fi

cat > $record/run/plan.json <<'JSON'
{
  "msps": [
    {"label": "limiter-core", "files": ["src/limiter/window.ts", "src/limiter/window.test.ts"], "steps": ["sliding-window", "limit-middleware"]},
    {"label": "redis-store", "files": ["src/store/redis.ts", "src/store/redis.test.ts"], "steps": ["redis-counter"]},
    {"label": "headers-docs", "files": ["docs/rate-limits.md"], "steps": ["limit-headers-docs"]}
  ],
  "lanes": [
    {"msp": 0, "steps": ["sliding-window"], "tier": "top", "cost": 1.2, "tokens": 180000},
    {"msp": 0, "steps": ["limit-middleware"], "tier": "top", "cost": 0.9, "tokens": 140000},
    {"msp": 1, "steps": ["redis-counter"], "tier": "top", "cost": 1.1, "tokens": 160000},
    {"msp": 2, "steps": ["limit-headers-docs"], "tier": "cheap", "cost": 0.1, "tokens": 40000}
  ],
  "tiers": {"sliding-window": "top", "limit-middleware": "top", "redis-counter": "top", "limit-headers-docs": "cheap"},
  "lane_order": [0, 2, 3, 1],
  "lane_after": {"1": [0]},
  "plan_id": "plan-fixture",
  "version": 2
}
JSON

lane_msps=(0 0 1 2)
{
  print -r -- '{'
  print -r -- '  "lanes": {'
  for lane in 0 1 2 3; do
    print -r -- "    \"$lane\": {\"lane\": $lane, \"msp\": ${lane_msps[lane + 1]}, \"state\": \"ok\", \"exit\": 0, \"commit\": \"c0ffee$lane\", \"started\": \"$(minutes_ago $(( 110 - lane )))\", \"finished\": \"$(minutes_ago $(( 100 - lane )))\"}${${lane:#3}:+,}"
  done
  print -r -- '  },'
  print -r -- '  "msps": {'
  for index in 1 2 3; do
    print -r -- "    \"$(( index - 1 ))\": {\"state\": \"committed\", \"gate\": null, \"reconcile\": null, \"ship\": $(ship_of ${MSPS[index]} $index)}${${index:#3}:+,}"
  done
  print -r -- '  },'
  print -r -- '  "worktrees": ['
  for index in 1 2 3; do
    print -r -- "    {\"branch\": \"mitosis/${MSPS[index]}\", \"label\": \"${MSPS[index]}\", \"msp\": $(( index - 1 )), \"path\": \"$mitosis/runs/spindle-fixture/$slug/trees/${MSPS[index]}\"}${${index:#3}:+,}"
  done
  print -r -- '  ],'
  print -r -- "  \"feature_branch\": \"feature/$slug\","
  print -r -- "  \"started\": \"$(minutes_ago 112)\","
  print -r -- '  "plan_id": "plan-fixture",'
  print -r -- '  "version": 2'
  print -r -- '}'
} > $record/run/state.json

{
  event 134 run.start '"lane": "full"'
  event 133 stage.start '"stage": "spec"'
  event 112 stage.start '"stage": "build"'
  for msp in $MSPS; do
    for round in ${=$(rounds_of $msp)}; do
      outcome=$(verdict_of $msp $round)
      event $(( 90 - 20 * round )) round.verdict "\"msp\": \"$msp\", \"round\": $round, \"outcome\": \"$outcome\", \"blockers\": $(blockers_for $outcome), \"advisories\": 0"
    done
  done
  if is_shipped; then
    event 40 stage.start '"stage": "ship"'
    event 30 stage.start '"stage": "integrate"'
    event 5 stage.start '"stage": "clean"'
    event 4 clean.done "\"record\": \"$record\", \"kept\": $(kept_count)"
  fi
  case $state in
    closed-done|closed-done-plain|unknown) event 3 run.end '"status": "done", "draft": false' ;;
    closed-draft) event 3 run.end '"status": "done", "draft": true' ;;
    stopped-critical)
      event 4 run.fail '"stage": "review", "command": "pipeline check-run", "exit": 1, "reason": "hard failure"'
      event 3 run.end '"status": "abandoned: stopped at review: hard failure"'
      ;;
    superseded) event 3 run.end '"status": "abandoned: superseded by rate-limit-api-2"' ;;
    abandoned) event 3 run.end '"status": "abandoned: owner dropped the work"' ;;
  esac
} > $events

[[ $state == unknown ]] && chmod 000 $events

print -r -- "{
  \"version\": 1,
  \"session_id\": \"$session_id\",
  \"thread_id\": \"$slug\",
  \"run_homes\": [{\"path\": \"$home\", \"anchor\": \"$anchor\"}],
  \"latest_anchor\": \"$anchor\"
}" > $session_file

print -r -- "Staged the $state finish for session $session_id:"
print -r -- "  session file  $session_file"
print -r -- "  run record    $record"
print -r -- "  event log     $events${${(M)state:#unknown}:+ (unreadable on purpose)}"
print -r -- "Load spindle from this branch over it, then open the run pane with /spindle:"
print -r -- "  claude --plugin-dir $repo_root/plugins/spindle --resume $session_id"
print -r -- "Compare the band and run pane with the data-state=\"$state\" frame of $repo_root/docs/mockups/finish-states.html."
