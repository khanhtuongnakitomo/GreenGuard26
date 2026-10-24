# Demo-Day Dashboard and Detection Guide

This guide explains how to start the local Dashboard and run the Trash-detection demo with either terminal output or an ESP controller.

## 1. Start the Dashboard

Open PowerShell and run:

```powershell
cd D:\Coding\Prj\BKI\GreenGuard26\Dashboard
.\run-dashboard.bat repair
```

Use `repair` the first time, or whenever the frontend dependencies are broken. It repairs only the Dashboard frontend dependencies.

For normal startup after repair:

```powershell
.\run-dashboard.bat
```

The launcher:

- Starts the backend in a visible window.
- Starts the frontend in a separate visible window.
- Uses live API mode instead of presentation mode.
- Checks backend port `3003`.
- Checks frontend port `8081`.
- Opens the Dashboard only after both services are ready.
- Writes service logs to `%TEMP%\greenguard-dashboard-local`.

The Dashboard is available at:

```text
http://127.0.0.1:8081
```

To check service status without starting anything:

```powershell
.\run-dashboard.bat status
```

## 2. Run Demo-Day in Terminal Mode

Open a second PowerShell window and run:

```powershell
cd D:\Coding\Prj\BKI\GreenGuard26\Trash-detection
.\demo-day.bat terminal
```

Terminal mode:

- Connects to the already-running Dashboard.
- Starts the existing parallel Model 1 + Model 2 detection workflow.
- Updates the live Dashboard after each completed object.
- Prints exactly one external signal number per completed object.
- Does not open or enumerate serial devices.

## 3. Run Demo-Day with an ESP Controller

With a known COM port:

```powershell
.\demo-day.bat esp COM7
```

If there is exactly one detected USB serial device, the port can be detected automatically:

```powershell
.\demo-day.bat esp
```

On the laptop checked on 2026-09-10, the attached ESP-compatible USB serial adapter was detected as `COM6` (`USB-SERIAL CH340`). You can therefore run:

```powershell
.\demo-day.bat esp COM6
```

The connected machine camera (`rapoo camera`) is OpenCV camera source `1`. Demo-Day now selects source `1` automatically. Camera source `0` is the laptop's other camera and is not used for the machine workflow.

To override the machine-camera index later:

```powershell
$env:DEMO_CAMERA_SOURCE = '2'
.\demo-day.bat esp
```

ESP mode is strict:

- The ESP connection is checked before the camera opens.
- A missing or ambiguous device stops detection.
- A failed serial write stops detection.
- It never silently falls back to terminal output.
- Each result sends exactly one ASCII byte at 115200 baud with no newline.

## 4. Signal Mapping

| Detection result | Dashboard value | Controller signal |
|---|---|---:|
| Aluminum | `aluminum` | `1` |
| Good PET | `pet_clean` | `2` |
| Bad PET | `pet_bad` | `3` |

The controller signals are sent as:

```text
Aluminum  -> b"1"
Good PET  -> b"2"
Bad PET   -> b"3"
```

The controller signal is sent before the Dashboard event is recorded. This prevents a failed ESP write from creating a falsely completed Dashboard event.

## 5. Detection Behavior

- Model 1 and Model 2 run in parallel during the voting window.
- Model 2 can immediately classify an object as Bad PET when any defect class crosses its threshold.
- Aluminum takes precedence over Model 2 defect results.
- Each completed result is frozen and the detector pauses until the operator presses Run, `S`, or Space.
- `P` pauses, `F` finalizes the active manual session, `Q` shows/hides the latest claim QR, `C` switches camera, and `X`/Escape exits.
- Hold frames and repeated keys do not create duplicate Dashboard events or controller signals.
- Manual sessions accumulate PET tốt, PET tệ, and aluminum quantities with GreenPoint points of 10/5/8.
- `F` creates a signed 15-minute GreenPoint claim QR and resets only the visible active-session counters after success.

## 6. Compatibility Launchers

The old launcher remains available:

```powershell
.\Demo-day-run.bat terminal
```

It forwards to `demo-day.bat`.

The diagnostic workflow remains separate:

```powershell
.\full_demo.bat
```

`full_demo.bat` keeps the diagnostic `SIGNAL 0/1/2 — NOT SENT` display and does not send Dashboard, terminal, serial, or hardware output unless explicitly configured with the relevant options.

## 7. Verification Status

- Dashboard API verified ready on port `3003`.
- Dashboard frontend verified ready on port `8081`.
- Browser verified using live Dashboard data rather than presentation data.
- Focused tests: `23 passed`.
- Backend tests: `11 passed`; typecheck passed.
- Frontend tests: `5 passed`; typecheck passed.
- PC suite: `79 passed`, with 5 known Model 1/parity failures remaining.
- Physical ESP verification: `NOT_MEASURED` because no controller was attached during verification.
