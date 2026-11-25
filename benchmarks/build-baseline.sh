#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Rebuild upstream LinuxPDF's RV32 edition using upstream C and JS unchanged.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir -p "${BENX_CACHE:-.cache}" build out
CACHE=$(realpath "${BENX_CACHE:-.cache}")
exec 9>build/.lock
flock 9
exec 8>"$CACHE/.lock"
flock 8
source scripts/dependencies.sh
prepare_common
download linuxpdf-upstream.tar.gz 9c9a3ac738792aae76e457a17822a4ba83d4ce05bd1e327aeaf563801c71b2c8 \
  https://codeload.github.com/ading2210/linuxpdf/tar.gz/9d6ff291a3c1f157b22ae6d196c9a3841a3de289
upstream="$CACHE/linuxpdf-9d6ff29"
if [[ ! -f "$upstream/.ready" ]]; then
    mkdir -p "$upstream"
    tar -xf "$CACHE/downloads/linuxpdf-upstream.tar.gz" --strip-components=1 -C "$upstream"
    touch "$upstream/.ready"
fi
make -C "$upstream/tinyemu" -f Makefile.pdfjs -j"${JOBS:-4}" js/riscvemu32.js
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/root" "$tmp/files/root"
# debugfs may report chown/device-node permission errors during rootless extraction.
"${DEBUGFS:-debugfs}" -R "rdump / $tmp/root" "$VM/root-riscv32.bin" 2>"$tmp/debugfs.log"
test -s "$tmp/root/bin/busybox"
cp "$upstream/init" "$tmp/root/sbin/init"
gcc "$upstream"/tinyemu/{build_filelist,fs_utils,cutils}.c -o "$tmp/build_filelist"
"$tmp/build_filelist" "$tmp/root" "$tmp/files/root"
cp "$upstream/vm_32.cfg" "$VM/bbl32.bin" "$VM/kernel-riscv32.bin" "$tmp/files/"
python3 "$upstream/embed_files.py" "$upstream/file_template.js" "$tmp/files" "$tmp/files.js"
cat "$CACHE/downloads/pako.min.js" "$tmp/files.js" "$upstream/pdflinux.js" \
    "$upstream/tinyemu/js/riscvemu32.js" > "$tmp/compiled.js"
python3 "$upstream/gen_pdf.py" "$tmp/compiled.js" out/LinuxPDF-baseline.pdf
printf '%s\n' 'out/LinuxPDF-baseline.pdf'
