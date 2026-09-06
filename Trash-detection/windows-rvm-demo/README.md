# Windows RVM demo source

This source is the Windows-specific kiosk shell around the canonical
`pc-demo/src` Model 1, gate, and Model 2 runtime. The builder copies those
shared files and the locked `main` ONNX artifacts into an ignored distribution
folder. Serial remains disabled by default; `--enable-serial` is an explicit
opt-in after camera-only validation.
