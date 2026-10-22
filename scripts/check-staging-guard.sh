#!/usr/bin/env zsh
set -euo pipefail

script=${0:A:h}/stage-finish-fixtures.sh
scratch=$(mktemp -d)
trap 'rm -rf -- $scratch' EXIT
sessions=$scratch/.mitosis/sessions
fixture_home=$scratch/.mitosis/spindle-fixture/closed-done-run
mkdir -p $sessions

refuses() {
  local name=$1 body=$2 code=0
  print -r -- $body > $sessions/$name.json
  local before=$(<$sessions/$name.json)
  HOME=$scratch zsh $script $name closed-done >/dev/null 2>&1 || code=$?
  if (( code != 2 )) || [[ $(<$sessions/$name.json) != $before ]]; then
    print -u2 "check-staging-guard: the staging script did not refuse $name (exit $code)"
    exit 1
  fi
}

restages() {
  local name=$1 code=0
  print -r -- "{\"version\":1,\"session_id\":\"$name\",\"thread_id\":\"closed-done-run\",\"run_homes\":[{\"path\":\"$fixture_home\"}]}" > $sessions/$name.json
  HOME=$scratch zsh $script $name superseded >/dev/null 2>&1 || code=$?
  if (( code == 2 )); then
    print -u2 "check-staging-guard: the staging script refused to re-stage $name, a session file it staged"
    exit 1
  fi
}

refuses real-thread-no-homes '{"version":1,"session_id":"real-thread-no-homes","thread_id":"my-real-thread","run_homes":[],"decision_recorded":true}'
refuses no-thread-no-homes '{"version":1,"session_id":"no-thread-no-homes","thread_id":null,"run_homes":[]}'
refuses real-thread-fixture-homes "{\"version\":1,\"session_id\":\"real-thread-fixture-homes\",\"thread_id\":\"my-real-thread\",\"run_homes\":[{\"path\":\"$fixture_home\"}]}"
restages own-staged-session

print "check-staging-guard: the staging script refuses every session file it did not write and re-stages one it did"
