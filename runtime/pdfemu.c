/* SPDX-License-Identifier: GPL-3.0-or-later */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <emscripten.h>

#include "cutils.h"
#include "iomem.h"
#include "virtio.h"
#include "machine.h"

enum { SECTOR_SIZE = 512, INPUT_CAPACITY = 4096, MAX_SLICE = 100000 };

static VirtMachine *machine;
static struct {
    uint8_t *data;
    uint32_t sectors;
} disk;
static uint8_t input[INPUT_CAPACITY];
static int input_head, input_size;

static int64_t disk_sectors(BlockDevice *device)
{
    return disk.sectors;
}

static int disk_read(BlockDevice *device, uint64_t sector, uint8_t *dest,
                     int count, BlockDeviceCompletionFunc *callback, void *opaque)
{
    if (count < 0 || sector > disk.sectors || (unsigned)count > disk.sectors - sector)
        return -1;
    memcpy(dest, disk.data + (uint32_t)sector * SECTOR_SIZE, count * SECTOR_SIZE);
    return 0;
}

static int disk_write(BlockDevice *device, uint64_t sector, const uint8_t *src,
                      int count, BlockDeviceCompletionFunc *callback, void *opaque)
{
    if (count < 0 || sector > disk.sectors || (unsigned)count > disk.sectors - sector)
        return -1;
    memcpy(disk.data + (uint32_t)sector * SECTOR_SIZE, src, count * SECTOR_SIZE);
    return 0;
}

static BlockDevice block_device = {
    .get_sector_count = disk_sectors,
    .read_async = disk_read,
    .write_async = disk_write,
};

extern void benx_console_write(void *opaque, const uint8_t *buf, int len);

static CharacterDevice console = {
    .write_data = benx_console_write,
};

EMSCRIPTEN_KEEPALIVE
int benx_start(int bits, int ram_mib, uint8_t *bios, int bios_len,
               uint8_t *kernel, int kernel_len, uint8_t *image, int image_len)
{
    if (machine || (bits != 32 && bits != 64) || ram_mib < 32 || ram_mib > 128 ||
        !bios || !kernel || !image || bios_len <= 0 || bios_len > (1 << 20) ||
        kernel_len <= 0 || kernel_len > ((ram_mib - 4) << 20) ||
        image_len <= 0 || image_len % SECTOR_SIZE)
        return 0;

    VirtMachineParams params = {
        .vmc = &riscv_machine_class,
        .machine_name = bits == 32 ? "riscv32" : "riscv64",
        .ram_size = (uint64_t)ram_mib << 20,
        .rtc_real_time = TRUE,
        .console = &console,
        .tab_drive = {{ .block_dev = &block_device }},
        .drive_count = 1,
        .cmdline = "console=hvc0 loglevel=4 swiotlb=1 root=/dev/vda rootfstype=ext4 "
                   "rw init=/sbin/benx-init",
        .files = {
            [VM_FILE_BIOS] = { .buf = bios, .len = bios_len },
            [VM_FILE_KERNEL] = { .buf = kernel, .len = kernel_len },
        },
    };

    disk.data = image;
    disk.sectors = image_len / SECTOR_SIZE;
    input_head = input_size = 0;
    machine = params.vmc->virt_machine_init(&params);
    return machine != NULL;
}

EMSCRIPTEN_KEEPALIVE
void benx_stop(void)
{
    if (!machine)
        return;
    virt_machine_end(machine);
    machine = NULL;
    disk.data = NULL;
    disk.sectors = 0;
    input_head = input_size = 0;
}

EMSCRIPTEN_KEEPALIVE
int benx_input(int byte)
{
    if (!machine || input_size == INPUT_CAPACITY)
        return 0;
    input[(input_head + input_size) % INPUT_CAPACITY] = byte;
    input_size++;
    return 1;
}

static void deliver_input(void)
{
    VIRTIODevice *device = machine->console_dev;
    if (!input_size || !virtio_console_can_write_data(device))
        return;
    int length = min_int(input_size, INPUT_CAPACITY - input_head);
    length = min_int(length, virtio_console_get_write_len(device));
    if (length > 0) {
        int written = virtio_console_write_data(device, input + input_head, length);
        input_head = (input_head + written) % INPUT_CAPACITY;
        input_size -= written;
    }
}

EMSCRIPTEN_KEEPALIVE
uint32_t benx_run(int budget)
{
    if (!machine || budget <= 0)
        return 0;
    budget = min_int(budget, MAX_SLICE);
    deliver_input();
    uint32_t before = riscv_machine_cycles(machine);
    while (budget > 0 && !virt_machine_get_sleep_duration(machine, 1)) {
        int cycles = min_int(budget, 4096);
        virt_machine_interp(machine, cycles);
        budget -= cycles;
    }
    return riscv_machine_cycles(machine) - before;
}
