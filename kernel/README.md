# Kernel and firmware inputs

Both kernels and both Berkeley Boot Loader binaries come from Bellard’s
`diskimage-linux-riscv-2018-09-23.tar.gz` archive. The exact archive digest
and download URL are recorded in [scripts/dependencies.sh](../scripts/dependencies.sh).

The archive's `patches/` directory includes RV32 and RV64 kernel configs
and patches for these source revisions.

| Component | Source revision |
| --- | --- |
| Linux | [a3b1e7acc6a181e04e9a943942084395df4498dd](https://github.com/riscvarchive/riscv-linux/tree/a3b1e7acc6a181e04e9a943942084395df4498dd) |
| Berkeley Boot Loader | [ac2c910b18c3e36cfd85080472e78ad2fe484325](https://github.com/riscv-software-src/riscv-pk/tree/ac2c910b18c3e36cfd85080472e78ad2fe484325) |

The build uses the raw binaries from the archive. The kernel needs its
historical RISC-V privileged-architecture ABI and built-in VirtIO block,
VirtIO console, and ext4 drivers.
