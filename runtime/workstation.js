// SPDX-License-Identifier: GPL-3.0-or-later
var benxInitialized = true;
var benxDoc = this;
var performance = { now: function () { return Date.now(); } };
var Module = {
  print: function (message) { benxNotice(message); },
  printErr: function (message) { benxNotice(message); },
  onAbort: function (message) { benxFail(message); },
  onRuntimeInitialized: function () { app.setTimeOut("benxBoot()", 120); }
};
var fields = Object.create(null);
var values = Object.create(null);
var terminal;
var phase = "idle";
var timer = null;
var diskPtr = 0;
var stats = null;
var instructions = 0;
var sampleTime = 0;
var lastPaint = 0;
var slice = 18000;
var inputBuffer = "";
var modifiers = { Shift: false, Ctrl: false, Alt: false, Caps: false };
var lastSubmit = "";

function benxSet(name, value) {
  if (values[name] === value) return;
  if (!fields[name]) fields[name] = benxDoc.getField(name);
  if (fields[name]) fields[name].value = value;
  values[name] = value;
}
function benxNotice(message) {
  benxSet("notice", String(message).slice(0, 66));
}
function benxState(value) {
  phase = value;
  benxSet("state", value.toUpperCase());
}
function benxFail(error) {
  if (timer !== null) app.clearInterval(timer);
  timer = null;
  benxState("error");
  benxNotice(error);
}
function benxTelemetry(message) {
  const data = /^777;(\d+);(\d+);(\d+)$/.exec(message);
  if (data) stats = { uptime: +data[1], total: +data[2], available: +data[3] };
}
function benxReceive(heap, start, length) {
  for (let i = start; i < start + length; i++) terminal.feed(heap[i]);
}
function benxPaint() {
  const rows = terminal.getRows();
  if (rows) {
    for (let i = 0; i < rows.length; i++) benxSet("row_" + i, rows[i].trimEnd());
    if (phase === "booting" && rows.some(row => /benx:.*# /.test(row))) {
      benxState("running");
      benxNotice("Linux shell ready");
    }
  }
}
var base64Lookup = new Uint8Array(128);
for (let i = 0, alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; i < alphabet.length; i++) {
  base64Lookup[alphabet.charCodeAt(i)] = i;
}
function benxDecode(value) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const data = new Uint8Array(value.length / 4 * 3 - padding);
  for (let i = 0, j = 0; i < value.length; i += 4) {
    const word = (base64Lookup[value.charCodeAt(i)] << 18) |
                 (base64Lookup[value.charCodeAt(i + 1)] << 12) |
                 (base64Lookup[value.charCodeAt(i + 2)] << 6) |
                  base64Lookup[value.charCodeAt(i + 3)];
    data[j++] = word >> 16;
    data[j++] = word >> 8;
    data[j++] = word;
  }
  return data;
}
function benxAsset(name) {
  const compressed = new Uint8Array(benxAssets.sizes[name]);
  let offset = 0;
  for (const encoded of benxAssets[name]) {
    const chunk = benxDecode(encoded);
    compressed.set(chunk, offset);
    offset += chunk.length;
  }
  const bytes = pako.inflate(compressed);
  const pointer = Module._malloc(bytes.length);
  if (!pointer) throw Error("Could not allocate " + name);
  Module.HEAPU8.set(bytes, pointer);
  return { pointer, length: bytes.length };
}
function benxBoot() {
  if (phase === "running" || phase === "booting" || phase === "loading") return;
  if (!Module._benx_start) return;
  benxState("loading");
  benxNotice("Preparing the embedded boot image");
  app.setTimeOut("benxStartMachine()", 20);
}
function benxStartMachine() {
  if (phase !== "loading") return;
  const scratch = [];
  try {
    const bios = benxAsset("bios");
    scratch.push(bios.pointer);
    const kernel = benxAsset("kernel");
    scratch.push(kernel.pointer);
    const root = benxAsset("root");
    diskPtr = root.pointer;
    terminal = new BenxTerminal(80, 24, benxTelemetry);
    stats = null;
    slice = 18000;
    benxPaint();
    if (!Module._benx_start(benxAssets.bits, benxAssets.ram, bios.pointer, bios.length,
                             kernel.pointer, kernel.length, root.pointer, root.length)) {
      throw Error("TinyEMU could not initialize the guest");
    }
    sampleTime = Date.now();
    lastPaint = sampleTime;
    instructions = 0;
    benxState("booting");
    benxNotice("Bootloader started. Waiting for Linux");
    timer = app.setInterval("benxTick()", 4);
  } catch (error) {
    benxReset();
    benxFail(error);
  } finally {
    for (const ptr of scratch) Module._free(ptr);
  }
}
function benxTick() {
  try {
    let count = 0;
    while (count < inputBuffer.length && Module._benx_input(inputBuffer.charCodeAt(count))) count++;
    if (count) inputBuffer = inputBuffer.slice(count);
    const start = Date.now();
    const executed = Module._benx_run(slice) >>> 0;
    const now = Date.now();
    if (executed >= slice * 0.9) {
      // Target a short interpreter slice so the viewer can handle the next event.
      const target = slice * 14 / Math.max(1, now - start);
      slice = Math.round(Math.max(5000, Math.min(50000, (slice * 3 + target) / 4)));
    }
    instructions += executed;
    if (now - lastPaint >= 50) {
      benxPaint();
      lastPaint = now;
    }
    if (now - sampleTime >= 1000) {
      benxSet("rate", Math.round(instructions / (now - sampleTime)) + " kIPS");
      instructions = 0;
      sampleTime = now;
      if (stats) {
        benxSet("memory", Math.round(stats.available / 1024) + " / " +
                Math.round(stats.total / 1024) + " MiB");
        const minutes = Math.floor(stats.uptime / 60);
        benxSet("uptime", minutes + "m " + (stats.uptime % 60) + "s");
      }
    }
  } catch (error) {
    benxFail(error);
  }
}
function benxReset() {
  if (timer !== null) app.clearInterval(timer);
  timer = null;
  if (Module._benx_stop) Module._benx_stop();
  if (diskPtr) Module._free(diskPtr);
  diskPtr = 0;
  inputBuffer = "";
  lastSubmit = "";
  for (const key of Object.keys(modifiers)) modifiers[key] = false;
  terminal = new BenxTerminal(80, 24, benxTelemetry);
  benxPaint();
  benxSet("mods", "");
  benxSet("rate", "-");
  benxSet("memory", "-");
  benxSet("uptime", "-");
  benxSet("command", "");
  benxState("idle");
  benxNotice("Select Boot to start a fresh Linux guest");
}
function benxRestart() {
  benxReset();
  benxBoot();
}
function benxSend(text) {
  if (phase !== "running" && phase !== "booting") {
    benxNotice("Boot Linux before sending input");
    return;
  }
  if (inputBuffer.length + text.length > 4096) {
    benxNotice("Input queue full. Try again after it drains");
    return;
  }
  inputBuffer += text;
}
function benxRun(text) {
  if (!text || text === lastSubmit) return;
  if (/[^\x20-\x7e]/.test(text)) {
    benxNotice("Use printable ASCII in the command field");
    return;
  }
  benxSend(text + "\r");
  lastSubmit = text;
  app.setTimeOut("benxClearCommand()", 1);
}
function benxClearCommand() {
  const field = benxDoc.getField("command");
  if (field.value === lastSubmit) field.value = "";
  lastSubmit = "";
}
const specialKeys = {
  Esc: "\x1b", Tab: "\t", Enter: "\r", Backspace: "\x7f", Space: " ",
  Up: "\x1b[A", Down: "\x1b[B", Right: "\x1b[C", Left: "\x1b[D",
  Home: "\x1b[H", End: "\x1b[F", Ins: "\x1b[2~", Del: "\x1b[3~",
  PgUp: "\x1b[5~", PgDn: "\x1b[6~",
  F1: "\x1bOP", F2: "\x1bOQ", F3: "\x1bOR", F4: "\x1bOS", F5: "\x1b[15~",
  F6: "\x1b[17~", F7: "\x1b[18~", F8: "\x1b[19~", F9: "\x1b[20~",
  F10: "\x1b[21~", F11: "\x1b[23~", F12: "\x1b[24~"
};
const unshifted = "`1234567890-=[]\\;',./";
const shifted = '~!@#$%^&*()_+{}|:"<>?';
function benxKey(key) {
  if (Object.prototype.hasOwnProperty.call(modifiers, key)) {
    modifiers[key] = !modifiers[key];
    benxSet("mods", Object.keys(modifiers).filter(k => modifiers[k]).join(" "));
    return;
  }
  let text = specialKeys[key] || key;
  if (/^[a-z]$/.test(text) && modifiers.Shift !== modifiers.Caps) text = text.toUpperCase();
  if (modifiers.Shift && unshifted.indexOf(text) !== -1) text = shifted[unshifted.indexOf(text)];
  if (modifiers.Ctrl && /^[A-Za-z@[\\\]^_]$/.test(text)) text = String.fromCharCode(text.toUpperCase().charCodeAt(0) & 31);
  if (modifiers.Alt) text = "\x1b" + text;
  modifiers.Shift = modifiers.Ctrl = modifiers.Alt = false;
  benxSet("mods", modifiers.Caps ? "Caps" : "");
  benxSend(text);
}
