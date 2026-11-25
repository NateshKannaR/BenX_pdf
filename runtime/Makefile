# SPDX-License-Identifier: GPL-3.0-or-later
BITS ?= 32
BUILD ?= ../build/emulator-$(BITS)
EMU := ../tinyemu
COMMON := cutils iomem json machine pci riscv_machine riscv_cpu simplefb softfp virtio
OBJECTS := $(addprefix $(BUILD)/,$(addsuffix .o,$(COMMON))) $(BUILD)/pdfemu.o
CFLAGS := -O3 -I$(EMU) -Wall -fno-strict-aliasing -MMD -MP -Wno-fastcomp \
          -DMAX_XLEN=$(BITS) -DCONFIG_RISCV_MAX_XLEN=$(BITS) -DCONFIG_BENX_PDF

$(BUILD)/emu.js: $(OBJECTS) bridge.js Makefile
	emcc -O3 -Wno-fastcomp --memory-init-file 0 --closure 0 --js-library bridge.js \
	  -s WASM=0 -s SINGLE_FILE=1 -s ENVIRONMENT=shell -s NO_EXIT_RUNTIME=1 \
	  -s NO_FILESYSTEM=1 -s TOTAL_MEMORY=160mb -s ALLOW_MEMORY_GROWTH=0 \
	  -s EXPORTED_FUNCTIONS='["_malloc","_free"]' -o $@ $(OBJECTS)

$(BUILD)/pdfemu.o: pdfemu.c Makefile | $(BUILD)
	emcc $(CFLAGS) -c $< -o $@

$(BUILD)/%.o: $(EMU)/%.c Makefile | $(BUILD)
	emcc $(CFLAGS) -c $< -o $@

$(BUILD):
	mkdir -p "$@"

-include $(OBJECTS:.o=.d)
