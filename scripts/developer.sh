#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
prepare_developer() {
    local target=riscv32-ilp32d--musl--stable-2024.05-1
    local sdk="$CACHE/$target"
    local compiler="$sdk/bin/riscv32-buildroot-linux-musl"
    local c4=f9c601a370c4932969aa8ded5cec403258e708ed8a4ff6037069083e45c2238e
    local lua=4f18ddae154e793e46eeab727c59ef1c0c0c2b744e7b94219710d76f530629ae
    DEVELOPER_TOOLS="$CACHE/developer-lua5.4.8-c4-2feb8c0"
    if [[ ! -f "$DEVELOPER_TOOLS/.ready" ]]; then
        download "$target.tar.xz" bbf26ec29272814da1eb5eb97339ed36d2dda66655c4c3612951e3cfb2b842ec \
          "https://toolchains.bootlin.com/downloads/releases/toolchains/riscv32-ilp32d/tarballs/$target.tar.xz"
        download lua-5.4.8.tar.gz "$lua" https://www.lua.org/ftp/lua-5.4.8.tar.gz
        download c4.tar.gz "$c4" https://codeload.github.com/rswier/c4/tar.gz/2feb8c0a142b2e513be69442c24af82dbaf41a25
        if [[ ! -f "$sdk/.ready" ]]; then
            tar --no-same-owner -xf "$CACHE/downloads/$target.tar.xz" -C "$CACHE"
            touch "$sdk/.ready"
        fi
        mkdir -p "$DEVELOPER_TOOLS" "$CACHE/developer-src"
        tar --no-same-owner -xf "$CACHE/downloads/lua-5.4.8.tar.gz" -C "$CACHE/developer-src"
        tar --no-same-owner -xf "$CACHE/downloads/c4.tar.gz" -C "$CACHE/developer-src"
        local source="$CACHE/developer-src"
        make -C "$source/lua-5.4.8/src" -j"${JOBS:-4}" generic CC="$compiler-gcc" \
          AR="$compiler-ar rcu" RANLIB="$compiler-ranlib" MYCFLAGS="-Os -fno-ident" MYLDFLAGS="-static -s"
        install -m 0755 "$source/lua-5.4.8/src/lua" "$source/lua-5.4.8/src/luac" "$DEVELOPER_TOOLS"
        # c4 uses word-sized variadic arguments, so its VM word must match RV32's ABI.
        sed -e 's/#define int long long//' "$source/c4-2feb8c0a142b2e513be69442c24af82dbaf41a25/c4.c" > "$source/c4-rv32.c"
        "$compiler-gcc" -Os -fno-ident -static -s "$source/c4-rv32.c" -o "$DEVELOPER_TOOLS/c4"
        touch "$DEVELOPER_TOOLS/.ready"
    fi
}
