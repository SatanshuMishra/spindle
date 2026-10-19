# Spindle never writes

Spindle reads the pipeline's files and the session's events and writes nothing: no file, no process, no stored value. A display that wrote pipeline state could corrupt the run it watches, and a test fails if any hook calls `$.fs.write`, `$.process` or `$.store`.

Status: accepted
