// SPDX-License-Identifier: GPL-3.0-or-later
// Test the shipped asm.js and guest images with test-only PDF form and timer adapters.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { setTimeout: delay } = require('node:timers/promises');

const fields = Object.create(null);
const app = {
  setInterval: (script, ms) => setInterval(() => execute(script), ms),
  clearInterval,
  setTimeOut: (script, ms) => setTimeout(() => execute(script), ms),
  alert: message => { throw new Error(message); },
};
const sandbox = vm.createContext({ app, getField: name => fields[name] ??= {} });
const execute = source => vm.runInContext(source, sandbox);
const screen = () => Array.from({ length: 24 }, (_, row) => fields['row_' + row]?.value || '').join('\n');
const command = line => execute('benxRun(' + JSON.stringify(line) + ')');

async function waitFor(predicate) {
  const deadline = Date.now() + 60000;
  while (!predicate()) {
    assert(Date.now() < deadline, screen());
    await delay(100);
  }
}

async function main() {
  execute(fs.readFileSync(process.argv[2], 'ascii'));
  await waitFor(() => fields.state?.value === 'RUNNING');
  command('uname -m; mkdir -p /tmp/lifecycle; echo transient > /tmp/lifecycle/value; cat /tmp/lifecycle/value');
  await waitFor(() => /^transient$/m.test(screen()));
  assert.match(screen(), /^riscv32$/m);

  command('vi /tmp/lifecycle/edit');
  await waitFor(() => /edit\s+1\/1/.test(screen()));
  for (const key of ['i', 'x', 'Esc', 'Shift', ';', 'w', 'q', 'Enter']) {
    execute('benxKey(' + JSON.stringify(key) + ')');
    await delay(125);
  }
  await waitFor(() => /benx:~#\s*$/.test(screen()));
  command('cat /tmp/lifecycle/edit');
  await waitFor(() => /^x$/m.test(screen()));

  execute('benxRestart()');
  await waitFor(() => fields.state?.value === 'RUNNING');
  command('test ! -e /tmp/lifecycle/value && echo PRISTINE');
  await waitFor(() => /^PRISTINE$/m.test(screen()));
  execute('benxReset()');
  assert.equal(fields.state.value, 'IDLE');
  assert.equal(execute('timer'), null);
  assert.equal(execute('diskPtr'), 0);
  console.log('Bundled VM boot, real guest writes, vi edits, restart, and reset passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
