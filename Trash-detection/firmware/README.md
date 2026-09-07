# RVM firmware reference

`reference/RVMRun.txt` is the byte-preserved legacy controller source copied
from the recovered machine checkout. Its SHA-256 is
`60eb1cea1befe9a963524a19167bb78e7b350f81898109fe9773d3e1e9458f2e`.

`rvm-v2/RVMRun_v2.ino` is a derived control-plane variant. The motor pins,
sensor logic, timing, and three sequence bodies are retained. Only the serial
dispatch contract changes:

- `?` replies exactly `RVM-V2`.
- ASCII `0`, `1`, and `2` acknowledge and run the aluminum, good-PET, and
  bad-PET routes respectively. The old sequence bodies are mapped as
  `0 -> lenh1 + lenh2`, `1 -> lenh1 + lenh3`, and `2 -> lenh1 + lenh4`.
- `ACK:<signal>` is emitted before a route and `DONE:<signal>` after it
  completes, including any background Motor 2 seek phase.
- Progress/status lines between ACK and DONE are expected; the desktop waits
  for the matching DONE or an `ERR...` line within a bounded timeout.
- `!` (and the compatibility `A`/`a`) is emergency stop. The stop is latched;
  `R`/`r` is the separate manual reset. `0` is never an emergency command in
  v2.

The firmware is reference-only. The desktop demo never flashes it
automatically; a qualified operator must manually flash and validate the v2
sketch on the target controller.
