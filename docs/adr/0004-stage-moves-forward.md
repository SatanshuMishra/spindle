# The stage only moves forward, and files outrank calls

The stage shown is the later of what the run's files show and what the session's tool calls show, and it never moves backward except from Fix to Review when a new round opens. A resumed session sees files but not the calls that came before it, and a call can run ahead of the files it will produce, so taking the later of the two and holding it stops the band flickering between stages.

Status: superseded by ADR-0005
