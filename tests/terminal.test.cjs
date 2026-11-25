// SPDX-License-Identifier: GPL-3.0-or-later
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const Terminal = vm.runInNewContext(fs.readFileSync('runtime/terminal.js', 'utf8') + '\nBenxTerminal;');

function write(terminal, text) {
  for (const byte of Buffer.from(text, 'ascii')) terminal.feed(byte);
}

test('wraps, scrolls and preserves leading spaces', () => {
  const terminal = new Terminal(8, 3, () => {});
  write(terminal, '123456789\r\nline 2\r\n last');
  assert.deepEqual(Array.from(terminal.getRows()), ['9       ', 'line 2  ', ' last   ']);
  assert.equal(terminal.getRows(), null);
});

test('returns terminal updates without leaking ANSI or telemetry text', () => {
  const telemetry = [];
  const terminal = new Terminal(8, 3, value => telemetry.push(value));
  write(terminal, 'old\r\nunchanged\x1b[2J\x1b[2;3Hnew\x1b]777;1;32;21\x07');
  assert.deepEqual(Array.from(terminal.getRows()), ['        ', '  new   ', '        ']);
  assert.deepEqual(telemetry, ['777;1;32;21']);
});

test('supports overwrite, erase and redraw for line-editing programs', () => {
  const terminal = new Terminal(8, 3, () => {});
  write(terminal, 'abcdef\r\x1b[3CXY\x1b[K\r\n123\b4');
  assert.deepEqual(Array.from(terminal.getRows()), ['abcXY   ', '124     ', '        ']);
});
