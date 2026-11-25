# Runtime architecture

A page-open action loads the PDF JavaScript stream. The stream contains pako, a base64 manifest of three deflated binaries, the terminal and timer code, and a single-file Emscripten asm.js build. A small set of PDF APIs provides document-open and button actions, form fields, and timers.

## Boot and virtual hardware

1. The runtime decodes and inflates the Berkeley Boot Loader, raw Linux kernel, and ext2 filesystem. The base64 decoder uses a fixed lookup table and bounded chunks.
2. `runtime/pdfemu.c` initializes the TinyEMU RISC-V machine. TinyEMU copies firmware and kernel into emulated RAM and creates the device tree. Linux boots through BBL, discovers MMIO VirtIO devices, and mounts the embedded filesystem.
3. Linux calls `/sbin/benx-init`. It mounts procfs, sysfs, and devpts, assigns a guest hostname, and starts an interactive BusyBox shell on `/dev/hvc0`. A sleeping telemetry script reads `/proc/uptime` and `/proc/meminfo` every eight guest seconds.
4. The PDF input field and key widgets send bytes to a bounded FIFO. TinyEMU writes the bytes to a guest VirtIO receive buffer. Output from the guest feeds a monochrome VT100 parser and updates only AcroForm rows whose rendered text changed.

The guest RAM size is set per edition. The JavaScript heap is preallocated at 160 MiB and also contains emulator state, disk data, and stack. All block reads and writes are synchronous copies with sector bounds checks. The guest has no network device. BenX uses no external fetch API and exposes no operating-system calls to the guest beyond emulated hardware.

## Scheduling and reset

The PDF timer requests a 4 ms interval. Interpreter batches adapt within fixed bounds toward roughly 14 ms of CPU work. The browser can delay timer dispatch substantially, especially with a background tab. BenX counts the delta of TinyEMU's instruction counter, repaints dirty text at most every 50 ms, and refreshes metrics once per second. These are requested intervals and limits, not timing guarantees.

Reset cancels the timer, releases the console and block devices and VM RAM, frees the disk, and clears UI state. Restart performs the same release before booting from the original assets. Closing the PDF destroys the viewer context. The guest cannot persist its rewritten disk through PDF save.

## Upstream differences

The imported commit includes the original LinuxPDF implementation and the complete TinyEMU tree. Comparing it with Bellard’s TinyEMU 2019-12-21 release shows that LinuxPDF changed `jsemu.c` and `js/lib.js` and added `Makefile.pdfjs`. The original CPU and device source matches that release. The BenX path keeps the RISC-V core and VirtIO model and uses only a serial console and a RAM-backed block device. It replaces the original framebuffer-to-ASCII renderer, virtual input device, asynchronous 9P asset layer, and privileged disk extraction. The original framebuffer remains available in the upstream baseline build for comparison.

The shipped kernels retain the upstream example configuration and Linux 4.15 lineage. Boot tuning focused on guest RAM size, device selection, fewer userspace services, and console verbosity. The kernel itself was not rebuilt. [Upstream and kernel source details](../CREDITS.md)
