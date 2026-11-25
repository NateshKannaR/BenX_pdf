// SPDX-License-Identifier: GPL-3.0-or-later
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { readFile, writeFile, mkdir } = require('node:fs/promises');
const http = require('node:http');
const { performance } = require('node:perf_hooks');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const viewport = { width: 1640, height: 1150 };
const baseline = {
  name: 'LinuxPDF RV32',
  file: process.argv[2] || 'out/LinuxPDF-baseline.pdf',
  ready: { x: 502, y: 61, width: 420, height: 22 },
  rate: { x: 1268, y: 641, width: 134, height: 19 },
  screen: { x: 500, y: 60, width: 936, height: 528 },
  enter: [1254, 731], command: [1280, 809],
};
const benx = {
  name: 'BenX Lite',
  file: process.argv[3] || 'out/BenX_Lite.pdf',
  ready: { x: 1295, y: 245, width: 235, height: 37 },
  rate: { x: 1295, y: 307, width: 235, height: 37 },
  screen: { x: 375, y: 219, width: 875, height: 448 },
  enter: [1459, 898], command: [700, 752], run: [1520, 748],
};
const current = () => performance.now();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const median = list => {
  const sorted = list.toSorted((a, b) => a - b);
  if (sorted.length < 1) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const snapshot = (page, clip) => page.screenshot({ clip, timeout: 25000 });
function ocr(png) {
  return new Promise((resolve, reject) => {
    const child = execFile('tesseract', ['stdin', 'stdout', '--psm', '7'], (error, stdout) =>
      error ? reject(error) : resolve(stdout.trim()));
    child.stdin.end(png);
  });
}
function changedPixels(a, b, threshold) {
  assert.equal(a.length, b.length);
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) +
        Math.abs(a[i + 2] - b[i + 2]) > threshold) changed++;
  }
  return changed;
}
async function measure(browser, target, template) {
  const pdf = await readFile(target.file);
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('dialog', async dialog => { errors.push(dialog.message()); await dialog.dismiss(); });
  const server = http.createServer((req, res) => {
    if (req.url !== '/workstation.pdf') return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length });
    res.end(pdf);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const result = { name: target.name, bytes: pdf.length,
    sha256: createHash('sha256').update(pdf).digest('hex'), ratesKips: [], enterToPaintMs: [] };
  try {
    const started = current();
    await page.goto(`http://127.0.0.1:${server.address().port}/workstation.pdf`);
    let matched = false;
    while (current() - started < 190000) {
      const image = await snapshot(page, target.ready);
      matched = target === baseline
        ? changedPixels(PNG.sync.read(image).data, template, 100) < 50
        : /RUNNING/.test(await ocr(image));
      if (matched) break;
      const text = await ocr(await snapshot(page, target.rate));
      const rate = /([0-9]+)\s*kIPS/i.exec(text);
      if (rate) result.ratesKips.push(Number(rate[1]));
      await delay(1000);
    }
    assert(matched, `Linux prompt did not appear in ${target.name}`);
    result.shellMs = Math.round(current() - started);
    result.medianBootKips = median(result.ratesKips);
    await page.screenshot({ path: `test-results/benchmark-${target === baseline ? 'upstream' : 'lite'}.png` });

    const pixels = async () => PNG.sync.read(await snapshot(page, target.screen)).data;
    for (let i = 0; i < 5; i++) {
      const previous = await pixels();
      const pressed = current();
      await page.mouse.click(...target.enter);
      while (current() - pressed < 3000) {
        if (changedPixels(previous, await pixels(), 80) > 180) {
          result.enterToPaintMs.push(Math.round(current() - pressed));
          break;
        }
      }
      await delay(150);
    }
    result.medianEnterToPaintMs = median(result.enterToPaintMs);

    await page.mouse.click(...target.command);
    await page.keyboard.type('seq 1000', { delay: 25 });
    if (target.run) await page.mouse.click(...target.run);
    else await page.mouse.click(...target.enter);
    let last = await pixels();
    const displayStart = current();
    let changes = 0, samples = 0;
    while (current() - displayStart < 2500) {
      const frame = await pixels();
      if (changedPixels(last, frame, 80) > 180) changes++;
      last = frame;
      samples++;
    }
    result.scrollDisplay = { changedSamples: changes, samples, durationMs: Math.round(current() - displayStart) };
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await context.close();
    server.close();
  }
}

async function main() {
  await mkdir('test-results', { recursive: true });
  const template = PNG.sync.read(await readFile('benchmarks/upstream-welcome.png')).data;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || '/usr/bin/chromium', chromiumSandbox: true,
  });
  try {
    const results = {
      browser: browser.version(),
      measurements: [await measure(browser, baseline, template), await measure(browser, benx, template)],
    };
    await writeFile('test-results/benchmark.json', JSON.stringify(results, null, 2) + '\n');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
