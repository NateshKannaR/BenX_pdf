// SPDX-License-Identifier: GPL-3.0-or-later
// Run against desktop Chromium with its built-in PDF viewer and sandbox enabled.
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { promisify } = require('node:util');
const { chromium } = require('playwright');
const run = promisify(execFile);

const edition = process.argv[2] || 'Lite';
const pdfPath = path.resolve(process.argv[3] || `out/BenX_${edition}.pdf`);
const report = path.resolve(process.env.BENX_TEST_RESULTS || 'test-results');
const viewport = { width: 1640, height: 1150 };
const regions = {
  console: { x: 375, y: 205, width: 880, height: 477 },
  state: { x: 1295, y: 245, width: 248, height: 36 },
  ram: { x: 1295, y: 377, width: 248, height: 38 },
  throughput: { x: 1295, y: 307, width: 248, height: 37 },
  document: { x: 332, y: 59, width: 1276, height: 982 },
};
const locations = { field: [710, 752], run: [1520, 748], boot: [1335, 635],
  restart: [1418, 634], reset: [1510, 634] };

async function ocr(page, clip) {
  const png = await page.screenshot({ clip, timeout: 20000 });
  const child = execFile('tesseract', ['stdin', 'stdout', '--psm', '6'], {
    env: { ...process.env, OMP_THREAD_LIMIT: '1' },
  });
  const result = new Promise((resolve, reject) => {
    const stdout = [];
    child.stdout.on('data', data => stdout.push(data));
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout.join('')) : reject(Error('tesseract failed')));
  });
  child.stdin.end(png);
  return result;
}

async function waitText(page, pattern, clip = regions.console, timeout = 65000) {
  const end = performance.now() + timeout;
  let output = '';
  while (performance.now() < end) {
    output = await ocr(page, clip);
    if (pattern.test(output)) return output;
    await page.waitForTimeout(180);
  }
  throw Error(`Missing ${pattern} in screenshot. Last OCR:\n${output}`);
}

async function submit(page, command) {
  await page.mouse.click(...locations.field);
  await page.waitForTimeout(150);
  await page.keyboard.type(command, { delay: 12 });
  await page.waitForTimeout(100);
  await page.mouse.click(...locations.run);
}

async function main() {
  const pdf = await fs.readFile(pdfPath);
  await fs.mkdir(report, { recursive: true });
  const server = http.createServer((req, res) => {
    if (req.url === '/workstation.pdf') {
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length });
      res.end(pdf);
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || '/usr/bin/chromium',
    chromiumSandbox: true,
  });
  const measurements = { edition, bytes: pdf.length, browser: browser.version(), validations: [] };
  let page;
  try {
    const context = await browser.newContext({ viewport });
    const external = [];
    const dialogs = [];
    context.on('request', request => {
      const url = request.url();
      if (/^https?:/.test(url) && !url.startsWith(origin + '/')) external.push(url);
    });
    page = await context.newPage();
    page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    const opened = performance.now();
    // The built-in extension fetches the PDF after the outer page load. Wait for boot,
    // then disable the network while the real guest is still starting.
    await page.goto(origin + '/workstation.pdf', { waitUntil: 'load' });
    await waitText(page, /BOOTING|RUNNING/, regions.state, 20000);
    await context.setOffline(true);
    const rates = [];
    while (performance.now() - opened < 320000) {
      const state = await ocr(page, regions.state);
      if (/RUNNING/.test(state)) break;
      const match = (await ocr(page, regions.throughput)).match(/(\d+)\s*kIPS/i);
      if (match) rates.push(Number(match[1]));
      await page.waitForTimeout(750);
    }
    const consoleText = await waitText(page, /benx:~#/, regions.console, 10000);
    assert.doesNotMatch(consoleText, /Download the original PDF/i);
    measurements.shellMs = Math.round(performance.now() - opened);
    measurements.bootRateSamplesKips = rates;
    measurements.validations.push('Executable PDF opened in Chromium and booted to a BusyBox prompt offline');
    console.log(`${edition} shell visible after ${measurements.shellMs} ms`);
    await waitText(page, /\d+\s*\/\s*\d+\s*MiB/i, regions.ram);
    measurements.validations.push('Guest memory telemetry rendered');

    if (edition === 'Lite') {
      const inputStart = performance.now();
      await submit(page, 'printf "INPUT%s\\n" OK');
      await waitText(page, /^INPUTOK$/m);
      measurements.inputMs = Math.round(performance.now() - inputStart);
      measurements.validations.push('Physical keyboard enters a command and Run submits it');

      // Use a new directory, a script, an empty file and an unpredictable guest-created value.
      const token = `FILE${Math.floor(100000 + Math.random() * 900000)}`;
      await submit(page, `mkdir /root/proof; cd /root/proof; touch empty; printf "echo %s\\n" ${token} > demo.sh; sh demo.sh > result; cat result; ls; uname -a; free; ps`);
      const output = await waitText(page, new RegExp(`Linux benx 4\\.15[\\s\\S]*riscv32`));
      let contents = output;
      if (!new RegExp(`^${token}$`, 'm').test(contents)) {
        await submit(page, 'cd /root/proof; cat result; ls');
        contents = await waitText(page, new RegExp(`^${token}$`, 'm'));
      }
      assert.match(contents, /demo\.sh/);
      assert.match(contents, /empty/);
      assert.match(contents, /result/);
      measurements.validations.push('Linux uname, mkdir, touch, echo, cat, ls, free and ps exercised through the PDF');

      await submit(page, 'clear; top -b -n 1 | head -n 10');
      await waitText(page, /Load average|PID.*PPID/i);
      await submit(page, "vi /root/proof/edit");
      await waitText(page, /\/root\/proof\/edit\s+\d+\/\d+/);
      // Key F-row begins at y=810 and printable rows advance at 29.33 CSS px.
      // vi starts in command mode. Press i, x, Esc, Shift+; (colon), w, q, Enter.
      const key = async (x, y) => {
        await page.mouse.click(x, y);
        await page.waitForTimeout(75);
      };
      await key(1058, 868); // i
      await key(666, 927); // x
      await key(410, 810); // Esc
      await key(462, 927); // Shift
      await key(1238, 898); // ;
      await key(598, 868); // w
      await key(521, 868); // q
      await key(1459, 898); // Enter
      await page.waitForTimeout(1400);
      await submit(page, "cat /root/proof/edit; echo EDITED");
      const edited = await waitText(page, /^EDITED$/m);
      assert.match(edited, /^x$/m);
      measurements.validations.push('BusyBox top executes and the virtual keyboard controls vi');

      await submit(page, 'clear; benx-info');
      await waitText(page, /Guest memory/);
      await page.screenshot({ path: path.join(report, 'Lite-console.png'), clip: regions.document });

      console.log('Lite guest commands, filesystem writes and vi passed');
      await page.mouse.click(...locations.reset);
      await waitText(page, /IDLE/, regions.state);
      await page.mouse.click(...locations.boot);
      await waitText(page, /RUNNING/, regions.state, 140000);
      await submit(page, 'test ! -e /root/proof/result && printf "RESET%s\\n" OK');
      await waitText(page, /^RESETOK$/m);
      await page.mouse.click(...locations.restart);
      await waitText(page, /RUNNING/, regions.state, 140000);
      measurements.validations.push('Reset, manual boot and restart work offline and clear guest changes');
    } else if (edition === 'Developer') {
      await submit(page, 'clear; lua ~/examples/hello.lua');
      await waitText(page, /Hello from Linux via Lua 5\.4/);
      await submit(page, 'luac -o /tmp/test.luac ~/examples/hello.lua && echo BYTECODEREADY');
      await waitText(page, /^BYTECODEREADY$/m);
      await submit(page, 'clear; lua /tmp/test.luac');
      await waitText(page, /Hello from Linux via Lua 5\.4/);
      await submit(page, 'c4 ~/examples/hello.c');
      const output = await waitText(page, /cycle\s*=\s*\d+/);
      assert.match(output, /C square 4\s*=\s*16/);
      assert.match(output, /Hello from Linux via Lua 5\.4/);
      measurements.validations.push('Native RV32 Lua, luac and c4 C bytecode compiler execute in Linux');
      await page.screenshot({ path: path.join(report, 'Developer-console.png'), clip: regions.document });
    } else if (edition === 'Advanced') {
      await submit(page, 'sh ~/examples/monitor.sh');
      const output = await waitText(page, /Linux benx 4\.15[\s\S]*riscv64/);
      assert.match(output, /Linux benx/);
      measurements.validations.push('RV64 kernel and system monitor script execute');
      await page.screenshot({ path: path.join(report, 'Advanced-console.png'), clip: regions.document });
    }

    assert.deepEqual(dialogs, []);
    assert.deepEqual(external, []);
    assert.deepEqual(await fs.readFile(pdfPath), pdf, 'host PDF is unchanged after guest writes');
    await page.close();
    assert.equal(context.pages().length, 0);
    measurements.validations.push('Tab closed with no external requests or viewer error dialogs');
    await fs.writeFile(path.join(report, `${edition}.json`), JSON.stringify(measurements, null, 2) + '\n');
    console.log(JSON.stringify(measurements, null, 2));
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(report, `${edition}-failure.png`) });
    throw error;
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
