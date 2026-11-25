# Build and validate

Build scripts support x86-64 Linux. Fastcomp 1.39.20 is required for the PDF viewer’s asm.js execution model. It is pinned by archive hash with Node 12 and Acorn. The guest archive, pako, pdfrw wheel, Developer toolchain, Lua, and c4 are also pinned and verified before extraction. The build caches toolchains, downloads, and object files.

## Docker

```bash
docker build --platform linux/amd64 \
  --build-arg BENX_UID="$(id -u)" --build-arg BENX_GID="$(id -g)" \
  -t benx-build .
for edition in lite developer advanced; do
  docker run --rm --platform linux/amd64 -v "$PWD:/source" benx-build "$edition"
done
```

The Debian image digest and Debian package snapshot are pinned. The container runs the packaging as an unprivileged user. The build downloads dependencies on the first run. Once populated, the same cache can be used with `--network none`. On systems with SELinux, use the host’s normal bind-mount labeling syntax.

## Arch Linux and native Linux

Install `base-devel`, `bash`, `curl`, `python`, `e2fsprogs`, `util-linux`, `xz`, and `bzip2` on Arch Linux. Debian package names can be found in the [Dockerfile](../Dockerfile). Then run `./build.sh lite`, `./build.sh developer`, or `./build.sh advanced`.

Every build writes a PDF and SHA-256 sidecar in `out/`. Set `BENX_CACHE`, `BENX_OUT`, or `JOBS` to override cache, output, or parallelism. For rootless extraction the build writes only a local copy of the original disk with `debugfs`. There are no loop mounts. Distinct host toolchains can create byte differences, so compare checksums within the same pinned container when testing reproducibility.

## Validation

```bash
make test
npm ci
CHROMIUM=/usr/bin/chromium npm run test:browser -- Lite
CHROMIUM=/usr/bin/chromium npm run test:browser -- Developer
CHROMIUM=/usr/bin/chromium npm run test:browser -- Advanced
make baseline
node benchmarks/browser.cjs
```

Browser validation needs Tesseract and desktop Chromium with the native PDF viewer. It uses Chromium with the browser sandbox enabled. A temporary loopback server delivers the complete PDF where managed browser policy blocks `file://`. The guest continues to boot and work with the browser context offline. The browser tests read visible output from screenshots. Artifacts and logs are written to `test-results/`.

The container build also checks PDF structure, forms, bundled assets, and the presence of asm.js. CI runs packaging and terminal tests. The full Chromium suite is intended for a machine that can start Chromium with its sandbox enabled.

## Landing page

Run `make editions website` to stage a static website, checksums, and the three PDFs under `site-build/`. Host that directory on any static server. Site files are separate from the PDF runtime.
