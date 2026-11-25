# BenX_pdf

- Keep runtime JavaScript compatible with PDFium and preserve the asm.js build.
- Keep the PDF self-contained. Browser DOM, external HTTP, and host file access belong outside its runtime.
- Preserve upstream copyright notices and identify exact specifications, inputs, and dependencies when changing the VM build.
- Run `make test` and build the affected editions. Run the Chromium tests when changing PDF UI, input, CPU scheduling, guest images, or reset.
- Record actual test and benchmark evidence. Mark measurements and viewer combinations that were not tested.
