#!/usr/bin/env python3
"""Overlay BenX files onto the ext image without mounting or changing host ownership."""
# SPDX-License-Identifier: GPL-3.0-or-later
import argparse
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("seed", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("edition")
    parser.add_argument("version")
    parser.add_argument("--tools", type=Path)
    args = parser.parse_args()
    project = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as tmp:
        overlay = Path(tmp) / "overlay"
        shutil.copytree(project / "rootfs/common", overlay)
        extra = project / "rootfs" / args.edition.lower()
        if extra.is_dir():
            shutil.copytree(extra, overlay, dirs_exist_ok=True)
        if args.tools:
            for name in ("lua", "luac", "c4"):
                shutil.copy2(args.tools / name, overlay / "usr/bin" / name)
        (overlay / "etc").mkdir(exist_ok=True)
        for name in ("edition", "version"):
            (overlay / "etc" / f"benx-{name}").write_text(getattr(args, name) + "\n")

        commands = ["mkdir /root/examples"]
        for path in sorted(overlay.rglob("*")):
            if path.is_dir():
                continue
            relative = "/" + path.relative_to(overlay).as_posix()
            mode = 0o100755 if path.stat().st_mode & 0o111 else 0o100644
            commands.extend((
                f'write "{path}" "{relative}"',
                f'set_inode_field "{relative}" mode 0{mode:o}',
                f'set_inode_field "{relative}" uid 0',
                f'set_inode_field "{relative}" gid 0',
                f'stat "{relative}"',
            ))
        recipe = Path(tmp) / "debugfs.txt"
        recipe.write_text("\n".join(commands) + "\n")
        image = Path(tmp) / "root.bin"
        shutil.copyfile(args.seed, image)
        env = dict(os.environ, E2FSPROGS_FAKE_TIME="1540000000", LC_ALL="C")
        result = subprocess.run(
            [os.environ.get("DEBUGFS", "debugfs"), "-w", "-f", recipe, image],
            env=env, text=True, capture_output=True, check=True,
        )
        expected = sum(command.startswith("stat ") for command in commands)
        if result.stdout.count("Inode: ") != expected or len(result.stderr.splitlines()) != 1:
            raise SystemExit(result.stdout + result.stderr)
        shutil.copyfile(image, args.output)


if __name__ == "__main__":
    main()
