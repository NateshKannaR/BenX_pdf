# SPDX-License-Identifier: GPL-3.0-or-later
.PHONY: all lite developer advanced editions baseline test website
all: lite
lite developer advanced:
	./build.sh $@
editions: lite developer advanced
baseline:
	./benchmarks/build-baseline.sh
test:
	node --test tests/terminal.test.cjs
website:
	./scripts/stage-site.sh
