# Architecture

## Runtime boundaries

| Runtime | Role | Ownership |
|---|---|---|
| `pc-demo/` | Windows diagnostic and fixed-camera machine runtime | ONNX inference, workflow, machine UI/transport |
| `jetson-runtime/` | Jetson Nano B01 deployment unit | Independent TensorRT/ONNX runtime |
| `training/` | Training, evaluation, and research | Never imported by either runtime |

PC and Jetson remain independent. Model artifacts are duplicated at their
deployment boundaries and checked by manifests. Machine transport is PC-only
and does not change the Jetson package.

## Shared data flow

```text
camera frame
  -> M1Pipeline: accepted aluminum or PET
  -> CanonicalWorkflow: exactly 7 observations, quorum 4
       aluminum -> ALUMINUM_CAN (internal 0)
       PET -> 0.5 s warmup
          -> M2Pipeline on full frame
          -> centers inside PET polygon, one highest-confidence hit per class
          -> exactly 7 observations, quorum 4
               clean -> PET_CLEAN (internal 1)
               defect -> PET_REJECT (internal 2)
```

M2 cap, label, and ring confidence at or above `0.50` produces a bad
observation. Missing M1 during M2 is abstention, never clean. No quorum emits
no result. A result is held for `1.5` seconds, followed by removal and eight
consecutive clear M1 frames before re-arm.

## Windows entrypoints

`src/app.py` is the diagnostic entrypoint for Model 1, Model 2, and full modes.
It owns diagnostic overlays and camera-switch controls. The first three root
BAT launchers call it and never construct a serial transport.

`src/machine_app.py` is the fixed-camera entrypoint. It opens camera index `1`
only, starts stopped, and passes frames through `MachineWorkflow`. The machine
renderer receives only the live frame and redacted state/result; it has no path
to draw boxes, polygons, confidence, frame rate, counters, legends, camera
selection, or diagnostics.

`src/machine_workflow.py` wraps `CanonicalWorkflow` for Run/Pause lifecycle.
An unfinished vote is invalidated on pause. If an item had begun, resume keeps
the clear gate; if no item had begun, resume returns directly to
`WAITING FOR OBJECT`. A canonical result produces one result-name event.

`src/serial_transport.py` is the final machine boundary. It selects an
explicit configured COM port first. Without one, it connects only when exactly
one USB serial device is enumerated; zero or multiple devices use terminal
fallback. Result names map to raw bytes: CANS/ALUMINUM_CAN `1`, GOOD/PET_CLEAN
`2`, BAD/PET_REJECT `3`. Serial is 115200, no newline, flushed, with no ACK or
retry. A write failure closes the connection and falls back once.

## Hardware boundary

Offline tests prove transitions, redaction, selection, byte shape, and failure
handling with fakes. They do not prove camera-1 optics, Windows backend
behavior on the kiosk, USB wiring, or lower-controller response.
