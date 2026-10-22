#!/usr/bin/env zsh
set -euo pipefail
setopt extended_glob

page=${1:-docs/mockups/finish-states.html}
lifecycle=docs/run-lifecycle.md

if [[ ! -r $page ]]; then
  print -u2 "check-mockup: cannot read $page"
  exit 1
fi
if [[ ! -r $lifecycle ]]; then
  print -u2 "check-mockup: cannot read $lifecycle"
  exit 1
fi

lifecycle_states() {
  local line in_table=0 in_section=0
  local -a cells
  while IFS= read -r line; do
    if [[ $line == '## Lifecycle states' ]]; then
      in_section=1
      continue
    fi
    (( in_section )) || continue
    if [[ $line == '## '* ]]; then
      break
    fi
    if [[ $line != '|'* ]]; then
      (( in_table )) && break
      continue
    fi
    in_table=$(( in_table + 1 ))
    (( in_table > 2 )) || continue
    cells=("${(@s:|:)line}")
    print -r -- ${${cells[2]##[[:space:]]#}%%[[:space:]]#}
  done < $lifecycle
}

markup_outside_scripts() {
  perl -0777 -pe 's{<script\b[^>]*>.*?</script>}{}gis' -- $page
}

frame_lacks() {
  local state=$1
  markup_outside_scripts | STATE=$state perl -0777 -ne '
    my $state = $ENV{STATE};
    my $has_class = sub { my ($markup, $name) = @_; $markup =~ /\bclass\s*=\s*"(?:[^"]*\s)?\Q$name\E(?:\s[^"]*)?"/ };
    unless (/<([a-zA-Z][\w-]*)\b[^>]*\bdata-state\s*=\s*"\Q$state\E"[^>]*>/g) { print "frame"; exit }
    my ($tag, $start, $depth) = ($1, pos(), 1);
    while ($depth > 0 && /<(\/?)\Q$tag\E\b[^>]*>/gi) { $depth += $1 ? -1 : 1 }
    if ($depth > 0) { print "closing tag"; exit }
    my $frame = substr($_, $start, pos() - $start);
    print "band" unless $has_class->($frame, "band");
    print "pane" if $has_class->($frame, "band") && !$has_class->($frame, "pane");
  '
}

has_reduced_motion_rule() {
  markup_outside_scripts | perl -0777 -ne '
    my @styles = /<style\b[^>]*>(.*?)<\/style>/gis;
    exit((grep { /\@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{[^@]*?animation\s*:\s*none/is } @styles) ? 0 : 1);
  '
}

states=(${(f)"$(lifecycle_states)"} unknown)
if (( ${#states} < 2 )); then
  print -u2 "check-mockup: no states in the Lifecycle states table of $lifecycle"
  exit 1
fi

for state in $states; do
  missing=$(frame_lacks $state)
  if [[ -n $missing ]]; then
    print -u2 "check-mockup: $state lacks its $missing in $page"
    exit 1
  fi
done

if ! has_reduced_motion_rule; then
  print -u2 "check-mockup: $page has no @media (prefers-reduced-motion: reduce) rule setting animation:none"
  exit 1
fi

print "check-mockup: ${#states} states each have a band and run pane frame in $page"
