#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
printf 'Working directory: %s\n' "$PWD"
printf 'Guest hostname: %s\n' "$(hostname)"
head -n 3 /proc/meminfo
ps
