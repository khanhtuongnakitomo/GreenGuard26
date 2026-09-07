# Run the Windows detection demo

This demo produces classification signals for a separate mechanical consumer.
It cannot connect to, command, stop, reset, or package a machine.

## Source checkout

Install the PC demo environment first:

```powershell
cd Trash-detection\pc-demo
powershell -ExecutionPolicy Bypass -File setup.ps1
cd ..\windows-demo
run_demo.bat --source 0
```

The launcher also accepts a video filename:

```powershell
run_demo.bat --source "C:\Demo Media\items.mp4"
run_demo.bat --source 0 --headless
run_demo.bat --source 0 --max-frames 1
```

For a source checkout, the launcher uses the bundled runtime when present,
otherwise the PC demo virtual environment, and finally `py -3.11`.

## Portable bundle

Build from `Trash-detection` with the staged Python 3.11 x64 runtime and local
wheels under `windows-demo\portable-runtime`:

```powershell
python scripts\build_windows_demo.py build --profile portable --zip
python scripts\build_windows_demo.py check --require-offline
python scripts\build_windows_demo.py headless-smoke
```

Unpack `dist\GreenGuard-Windows-Detection-Demo` anywhere, including a path
with spaces, and run:

```powershell
run_demo.bat --source 0
run_demo.bat --source "C:\Demo Media\items.mp4" --headless
```

The bundle includes an embedded offline runtime and does not need system
Python or internet access at run time. `scripts\self_check.py` verifies the
models, configuration, and detection-only package boundary.

## Process interface

After startup, stdout contains only completed detection lines. Each line is
exactly one ASCII digit plus a newline:

```text
0
1
2
```

`0` is an aluminum can, `1` is good PET, and `2` is bad PET. A line is emitted
once at the exact 4/7 decision frame. There is no line for warmup, missing or
unknown detections, PP, a no-quorum window, result hold, or clear/re-arm frames.
Diagnostics, headless frame status, model loading, warnings, and camera errors
are written to stderr. A broken output pipe is reported on stderr and exits
nonzero without retry. Process exit codes describe application status and must
never be interpreted as classification signal `0`.

The intended integration is line-oriented:

```powershell
run_demo.bat --source 0 | mechanical-consumer.exe
```

The consumer owns all physical work and must accept only exactly `0`, `1`, or
`2`. Pause or turn the demo off to invalidate an in-progress vote. Removing an
item requires eight clear frames before the next item can be recognized.

Safe termination is `Q` or `Esc` in the UI, or Ctrl+C in a terminal. Stopping
the producer does not issue a machine command; the consumer must define its
own safe shutdown policy.

## Troubleshooting

- Run `python scripts\build_windows_demo.py check` and the bundle self-check
  before handing over a portable folder.
- If the camera is unavailable, confirm Windows camera permissions and try a
  different `--source` index. For a file, quote the complete path.
- Keep quotes around paths containing spaces. The launcher changes to its own
  directory before loading models, so relocation is supported.
- A one-frame smoke generally emits no stdout signal; its status belongs on
  stderr. This is expected when seven observations and a quorum have not been
  completed.
- The demo has no machine transport, controller module, firmware, emergency
  action, acknowledgement path, or motor logic. Any physical response must be
  implemented and tested in the separate mechanical codebase.
