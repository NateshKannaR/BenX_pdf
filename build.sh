#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
export LC_ALL=C PYTHONHASHSEED=0 SOURCE_DATE_EPOCH=1540000000
export TZ=UTC

case "${1:-lite}" in
    lite) edition=Lite; bits=32; ram=48 ;;
    developer) edition=Developer; bits=32; ram=64 ;;
    advanced) edition=Advanced; bits=64; ram=96 ;;
    *) printf 'Usage: %s [lite|developer|advanced]\n' "$0" >&2; exit 2 ;;
esac

if [[ $(uname -m) != x86_64 ]]; then
    printf 'The pinned Fastcomp binaries require an x86-64 Linux build host.\n' >&2
    exit 1
fi
for command in curl sha256sum tar python3 make flock "${DEBUGFS:-debugfs}"; do
    command -v "$command" >/dev/null || { printf 'Missing build dependency %s\n' "$command" >&2; exit 1; }
done
mkdir -p "${BENX_CACHE:-.cache}" build "${BENX_OUT:-out}"
CACHE=$(realpath "${BENX_CACHE:-.cache}")
output=$(realpath "${BENX_OUT:-out}")
exec 9>build/.lock
flock 9
exec 8>"$CACHE/.lock"
flock 8
source scripts/dependencies.sh
prepare_common

version=$(<VERSION)
root="build/root-$edition.bin"
root_args=()
if [[ $edition == Developer ]]; then
    source scripts/developer.sh
    prepare_developer
    root_args=(--tools "$DEVELOPER_TOOLS")
fi
make -C runtime -j"${JOBS:-4}" "BITS=$bits"
python3 scripts/root-image.py "$VM/root-riscv$bits.bin" "$root" "$edition" "$version" "${root_args[@]}"
pdf="$output/BenX_$edition.pdf"
python3 pdf/generate.py --bits "$bits" --ram "$ram" --edition "$edition" --version "$version" \
  --bios "$VM/bbl$bits.bin" --kernel "$VM/kernel-riscv$bits.bin" --root "$root" \
  --pako "$CACHE/downloads/pako.min.js" --emulator "build/emulator-$bits/emu.js" --output "$pdf.partial"
mv -f "$pdf.partial" "$pdf"
python3 tests/check_pdf.py "$pdf" "$edition" "$bits"
(cd "$output" && sha256sum "${pdf##*/}" > "${pdf##*/}.sha256")
printf '%s\n' "$pdf"
