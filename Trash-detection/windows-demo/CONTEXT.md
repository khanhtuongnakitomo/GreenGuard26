# GreenGuard Windows detection demo context

## Boundary change

The original Windows kiosk combined camera inference with a machine-control
plane. A completed material/quality decision was translated into a route and
the same process owned device communication, progress handling, operator stop
and reset controls, and firmware packaging.

That boundary is now intentionally split. This repository is a strict
detection producer: it observes the camera, applies the locked decision
contract, and publishes a result. A separate mechanical codebase owns every
physical-machine concern. Keeping that boundary explicit prevents a camera
process from assuming that a physical route started, finished, or is safe.

## Current architecture

Model 1 detects aluminum, PET, or PP. PP and unknown/missing observations are
abstentions. The existing Model 1 and Model 2 binaries, labels, thresholds,
preprocessing, and inference behavior are unchanged. The canonical workflow
collects exactly seven observations and resolves a 4/7 quorum. Aluminum emits
`0`, good PET emits `1`, and bad PET emits `2`. PET first passes through the
existing warmup and then uses the same seven-observation quality window.

`WorkflowStep.signal` is the library contract: `None` means no completed
decision on that frame; an integer is present only on the exact decision frame.
The Windows adapter writes one flushed ASCII stdout line per physical item.
Result text may remain visible during its hold, but no signal repeats. PP,
unknown, missing, warmup, no-quorum, result-hold, and clear/re-arm frames do
not write a line. After a result, eight clear frames are required before the
next item can be processed.

## Removed ownership

The current tree and bundle no longer contain a machine controller, machine
commands, acknowledgements, retries, protocol/baud/port settings, emergency
stop, machine reset, motor sequencing, or firmware sources. The Windows
adapter has only detection controls: start, pause, supported camera selection,
and quit. Process exit status is application status, never classification value
`0`.

The future mechanical codebase must read exactly `0`, `1`, or `2` lines from
stdout, perform all routing, acknowledgements, retries, safety controls, motor
sequencing, and firmware work, and decide how to handle its own failures. It
must not infer a result from process exit codes or assume that a result hold is
a second signal.

Old firmware is recoverable from Git history at the pre-refactor recovery
commit, but it is not part of this current tree or generated bundle.
