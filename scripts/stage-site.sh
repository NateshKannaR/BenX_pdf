#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
destination=${1:-site-build}
pdf_dir=${BENX_OUT:-out}
mkdir -p "$destination/downloads" "$destination/assets"
install -m 0644 web/index.html web/site.css "$destination/"
install -m 0644 web/assets/*.png "$destination/assets/"
for edition in Lite Developer Advanced; do
    install -m 0644 "$pdf_dir/BenX_$edition.pdf" "$pdf_dir/BenX_$edition.pdf.sha256" "$destination/downloads/"
done
touch "$destination/.nojekyll"
