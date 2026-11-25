# Validation

Builds and runtime tests used x86-64 Linux and Chromium 156.0.8078.79. The managed viewer blocked `file://` navigation, so browser automation opened the standalone PDFs over a temporary loopback server. Tests disabled browser networking after the PDF extension had loaded the document. No page or server implements any guest functionality.

## v1.0.1 opening instructions

The public Lite link started a download in Chromium. All three public downloads matched the locally built files byte for byte. Poppler rendered the opening instructions and the `WAITING FOR JS` message as static content. Chromium replaced the opening instructions with the Linux shell in the offline loopback tests.

| Edition | Chromium time to shell | Browser results |
| --- | ---: | --- |
| Lite | 34.4 s | [Command input, guest writes, vi, reset, and restart](evidence/v1.0.1/Lite.json) |
| Developer | 32.5 s | [Lua, luac, and c4](evidence/v1.0.1/Developer.json) |
| Advanced | 64.3 s | [RV64 kernel and system monitor](evidence/v1.0.1/Advanced.json) |

The managed test browser still blocked direct `file://` navigation. [Static render](evidence/v1.0.1/static-preview.png), [running Lite console](evidence/v1.0.1/lite-console.png), [v1.0.1 downloads](https://github.com/NateshKannaR/BenX_pdf/tree/artifacts/v1.0.1), [passing CI run](https://github.com/NateshKannaR/BenX_pdf/actions/runs/45541540193)

## v1.0.0 artifacts

| Edition | Bytes | SHA-256 |
| --- | ---: | --- |
| Lite | 3,830,324 | `f375f10e25ae82ae603cb0567302c095a10eb4a29c265432850bbd40376983a5` |
| Developer | 4,220,678 | `50a71aad3313a2baf83dec7d3ce93fa8545ded6c7f98d7adfbe1ecdd195098ca` |
| Advanced | 4,483,586 | `31a79b98a58a75d30a64325ad42e3cb91b04d2edbe17b64d5445adfe6343f971` |

The GitHub downloads were fetched back and matched the local PDFs byte for byte. The privately deployed landing page packages those same files. The build workflow succeeded for all three editions, uploaded its artifacts, and passed three terminal tests and the guest lifecycle test. [Public PDFs and checksums](https://github.com/NateshKannaR/BenX_pdf/tree/artifacts/v1.0.0), [successful CI run](https://github.com/NateshKannaR/BenX_pdf/actions/runs/45538201949)

## v1.0.0 evidence

- LinuxPDF's published PDF and a rebuild using the pinned upstream source reached the actual BusyBox prompt in Chromium. See the [benchmark capture](../benchmarks/chromium-156.json).
- The final Lite PDF booted offline in Chromium in 31.9 seconds. The browser test exercised the physical command field, real Linux commands, guest file writes and reads, a shell script, batch `top`, and saving in vi with the virtual keyboard. Reset cleared the written file, manual Boot started a fresh guest, and Restart returned to the prompt. The tab closed without external HTTP requests or viewer errors. [Browser result](evidence/lite.json), [Chromium screenshot](evidence/lite-console.png)
- A host-side diagnostic extracted the exact final Lite PDF's JavaScript, ran the asm.js VM with test-only form and timer adapters, and checked guest writes, edits in vi through virtual key handlers, restart into a pristine disk, and reset releasing the timer and disk. The same diagnostic is in `tests/session.cjs`.
- Developer booted offline in Chromium in 30.9 seconds, compiled and executed Lua bytecode, and ran the c4 example. Chromium displayed `C square 4 = 16`, c4's instruction count, and the shell prompt. The tab closed without external HTTP requests or viewer errors. [Browser result](evidence/developer.json), [Chromium screenshot](evidence/developer-console.png)
- Advanced booted to a BusyBox prompt in 65.3 seconds in an isolated offline Chromium run and executed its system monitor. The diagnostic harness also captured `rv64acdfimsu`, `sv48`, memory usage, and mount and filesystem data. [Browser result](evidence/advanced.json), [Chromium screenshot](evidence/advanced-console.png)

Concurrent Chromium runs exceeded the timing budget on this host. Use one browser at a time when reproducing the browser suite. These tests use viewer screenshots and may need crop adjustments on variations of Chromium's PDF toolbar.
