# Browser benchmark

Captured on 25 November 2026 using Chromium 156.0.8078.79, its built-in PDF viewer, an AMD EPYC 9V74 cloud host with three visible vCPUs, and a 1640 × 1150 viewport. The script opens the two PDFs sequentially on loopback. These are observation points from one paired run. A browser test and cloud scheduling shared the machine during the run.

| Metric | Rebuilt LinuxPDF RV32 | BenX Lite |
| --- | ---: | ---: |
| PDF bytes | 6,284,428 | 3,830,292 |
| Navigation to visible prompt | 58,316 ms | 40,459 ms |
| Median displayed boot kIPS | 1,050.5 | 1,650 |
| Median virtual Enter to visible change | 458.5 ms | 486 ms |
| Observed console changes during the scroll window | 3 / 13 samples in 2,527 ms | 1 / 21 samples in 2,575 ms |

BenX used 39% fewer file bytes and reached its shell about 31% sooner in this run. The JSON includes the precise hashes, distinguishing the benchmark builds from later packaging and UI revisions. [Raw capture](chromium-156.json)

## Method

- **Baseline.** Unmodified emulation, PDF JavaScript, VM configuration, and PDF generator from LinuxPDF `9d6ff29`. The build extracts the original ext2 root with `debugfs` in place of a privileged mount, then runs the upstream 9P indexing and PDF packaging. The published upstream PDF also reached a shell in Chromium.
- **Shell time.** Monotonic time from navigation to the upstream welcome-screen template or the BenX `RUNNING` field. The polling interval and OCR add observation delay.
- **Throughput.** Median of visible kIPS samples during boot. LinuxPDF reports scheduled 1,000-cycle chunks. BenX measures the TinyEMU instruction-counter delta. Different counters and boot workloads make this an operational indicator rather than a controlled CPU microbenchmark.
- **Input latency.** Click the on-page Enter key at a shell prompt and measure until more than 180 console pixels change. Four of five baseline attempts and five of five BenX attempts met the threshold within three seconds. Paint detection includes browser screenshot latency and any cursor or refresh activity.
- **Display refresh.** Type `seq 1000`, then sample framebuffer or console crops for changes over approximately 2.5 seconds. Sampling starts after the first post-submit capture and can miss a short burst. The counts represent observed changes, not hardware refresh rate or a rendering-speed improvement. BenX's runtime caps repaint attempts at 20 Hz and skips unchanged text rows. The original C framebuffer already tracks dirty pages, and its JavaScript still walks each returned pixel.

## Reproduce

```bash
make baseline lite
npm ci
CHROMIUM=/usr/bin/chromium node benchmarks/browser.cjs
```

Tesseract is required. The benchmark compares pixel crops at 100% PDF zoom with Chromium's sidebar open. If the viewer layout changes, update the crop and click coordinates, or compare the PDFs manually. `test-results/` contains the raw data for the new run and screenshots from both viewers.
