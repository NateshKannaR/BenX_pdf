#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
printf 'CPU and kernel\n'
uname -a
head -n 8 /proc/cpuinfo
printf '\nMemory and load\n'
free
cat /proc/loadavg
printf '\nMounts and free space\n'
cat /proc/mounts
df -h
