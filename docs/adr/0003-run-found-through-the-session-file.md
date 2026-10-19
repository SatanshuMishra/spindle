# The run is found through the session file, never from the working directory

Spindle takes the run home from the session file's `run_homes` entries whose anchor names the session's `thread_id`: the one that carries `latest_anchor`, or the newest (the pipeline lists them newest first) when the anchor names a recorded decision, and never builds a run home path from the working directory. One run's files can sit under two repository names (a checkout folder and the repository it builds), so a path built from the working directory would show the wrong run or none.

Status: accepted
