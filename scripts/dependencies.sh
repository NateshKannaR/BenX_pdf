#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Sourced by build.sh and benchmarks/build-baseline.sh.

download() {
    local name=$1 hash=$2 url=$3 file="$CACHE/downloads/$1"
    mkdir -p "$CACHE/downloads"
    if [[ -f "$file" ]] && printf '%s  %s\n' "$hash" "$file" | sha256sum --status -c; then
        return
    fi
    curl --fail --location --silent --show-error --retry 3 -o "$file.partial" "$url"
    printf '%s  %s\n' "$hash" "$file.partial" | sha256sum --strict -c
    mv -f "$file.partial" "$file"
}

prepare_fastcomp() {
    local sdk="$CACHE/fastcomp-1.39.20"
    if [[ ! -f "$sdk/.ready" ]]; then
        download fastcomp.tbz2 f15d1ee6d7bbe7664f56d557787df780f24a6d3bbc55f66a65b18d9234ad3b19 \
          https://storage.googleapis.com/webassembly/emscripten-releases-builds/linux/e7e39da9c81faecd9ecf44065cee864d76e4e34d/wasm-binaries.tbz2
        download node-v12.18.1-linux-x64.tar.xz 863f816967e297c9eb221ad3cf32521f7ac46fffc66750e60f159ed63809affa \
          https://storage.googleapis.com/webassembly/emscripten-releases-builds/deps/node-v12.18.1-linux-x64.tar.xz
        mkdir -p "$sdk/dist" "$sdk/node" "$sdk/tmp"
        tar --no-same-owner -xf "$CACHE/downloads/fastcomp.tbz2" --strip-components=1 -C "$sdk/dist"
        tar --no-same-owner -xf "$CACHE/downloads/node-v12.18.1-linux-x64.tar.xz" --strip-components=1 -C "$sdk/node"
        cat > "$sdk/config" <<'PY'
import os
sdk = os.path.dirname(os.environ["EM_CONFIG"])
NODE_JS = sdk + "/node/bin/node"
LLVM_ROOT = sdk + "/dist/fastcomp/bin"
BINARYEN_ROOT = sdk + "/dist"
EMSCRIPTEN_ROOT = sdk + "/dist/emscripten"
EMSCRIPTEN_NATIVE_OPTIMIZER = sdk + "/dist/bin/optimizer"
TEMP_DIR = sdk + "/tmp"
COMPILER_ENGINE = NODE_JS
JS_ENGINES = [NODE_JS]
PY
        touch "$sdk/.ready"
    fi
    local acorn="$sdk/dist/emscripten/node_modules/acorn"
    if [[ ! -f "$acorn/package.json" ]]; then
        download acorn-7.3.1.tgz 80fcad5efdc6419aef7760e1b9654fa76ee3a35735b3300ff5ca785ff7067767 \
          https://registry.npmjs.org/acorn/-/acorn-7.3.1.tgz
        mkdir -p "$acorn"
        tar --no-same-owner -xf "$CACHE/downloads/acorn-7.3.1.tgz" --strip-components=1 -C "$acorn"
    fi
    export EM_CONFIG="$sdk/config"
    export EM_CACHE="$sdk/cache"
    export PATH="$sdk/dist/emscripten:$sdk/node/bin:$PATH"
}

prepare_common() {
    download vm.tar.gz 808ecc1b32efdd76103172129b77b46002a616dff2270664207c291e4fde9e14 \
      https://bellard.org/tinyemu/diskimage-linux-riscv-2018-09-23.tar.gz
    download pako.min.js ede2693a4a6a5126b9d35669062b358ecab6ae7b9b86a1cf302feb45a8514907 \
      https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js
    download pdfrw-0.4-py2.py3-none-any.whl 758289edaa3b672e9a1a67504be73c18ec668d4e5b9d5ac9cbc0dc753d8d196b \
      https://files.pythonhosted.org/packages/c0/84/af442c4458756bb0c0d2424102d1200616f3ff9b82c48aaa130e08549bf6/pdfrw-0.4-py2.py3-none-any.whl
    VM="$CACHE/diskimage-linux-riscv-2018-09-23"
    if [[ ! -f "$VM/.ready" ]]; then
        tar --no-same-owner -xf "$CACHE/downloads/vm.tar.gz" -C "$CACHE"
        touch "$VM/.ready"
    fi
    export PYTHONPATH="$CACHE/downloads/pdfrw-0.4-py2.py3-none-any.whl"
    prepare_fastcomp
}
