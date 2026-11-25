# Validation

Builds and runtime tests used x86-64 Linux and Chromium 156.0.8078.79. The managed viewer blocked `file://` navigation, so browser automation opened the standalone PDFs over a temporary loopback server. Tests disabled browser networking after the PDF extension had loaded the document. No page or server implements any guest functionality.

## Artifacts

| Edition | Bytes | SHA-256 |
| --- | ---: | --- |
| Lite | 3,830,324 | `f375f10e25ae82ae603cb0567302c095a10eb4a29c265432850bbd40376983a5` |
| Developer | 4,220,678 | `50a71aad3313a2baf83dec7d3ce93fa8545ded6c7f98d7adfbe1ecdd195098ca` |
| Advanced | 4,483,586 | `31a79b98a58a75d30a64325ad42e3cb91b04d2edbe17b64d5445adfe6343f971` |

The GitHub downloads were fetched back and matched the local PDFs byte for byte. The privately deployed landing page packages those same files. The separate build workflow succeeded for all three editions, uploaded its artifacts, and passed three automated terminal tests. [Public PDFs and checksums](https://github.com/NateshKannaR/BenX_pdf/tree/artifacts/v1.0.0), [successful CI run](https://github.com/NateshKannaR/BenX_pdf/actions/runs/45537127745)

## Evidence

- LinuxPDF's published PDF and a rebuild using the pinned upstream source reached the actual BusyBox prompt in Chromium. See the [benchmark capture](../benchmarks/chromium-156.json).
- BenX Lite's final downloadable bytes reached the BusyBox prompt in isolated Chromium. Earlier interactive Chromium checks ran `uname -a`, `mkdir`, `touch`, `echo`, `cat`, `ls`, `sh`, `free`, `ps`, and batch `top`. The shell returned a Linux 4.15 kernel string, real process and memory data, and a token written to a guest file while the browser was offline.
- A host-side diagnostic extracted the exact final Lite PDF's JavaScript, ran the asm.js VM with test-only form and timer adapters, and checked guest writes, edits in vi through virtual key handlers, restart into a pristine disk, and reset releasing the timer and disk. The same diagnostic is in `tests/session.cjs`.
- Developer's Linux shell compiled and executed Lua bytecode and ran the c4 example in Chromium and in the diagnostic harness. Chromium displayed `C square 4 = 16` followed by c4's instruction count and the shell prompt.
- The Advanced diagnostic ran `uname -a` and the monitoring script on an RV64 Linux 4.15 guest. It reported `riscv64`, `rv64acdfimsu`, `sv48`, guest memory, and actual mount and disk data.

Concurrent Chromium runs exceeded the timing budget on this host. Use one browser at a time when reproducing the browser suite. These tests use viewer screenshots and may need crop adjustments on variations of Chromium's PDF toolbar.
