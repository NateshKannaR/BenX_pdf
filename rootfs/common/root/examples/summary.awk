# SPDX-License-Identifier: GPL-3.0-or-later
# Run with awk -f ~/examples/summary.awk /proc/meminfo
/^(MemTotal|MemFree|MemAvailable):/ { printf "%-16s %7.1f MiB\n", $1, $2 / 1024 }
