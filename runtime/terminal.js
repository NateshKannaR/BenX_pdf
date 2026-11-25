// SPDX-License-Identifier: GPL-3.0-or-later
// A monochrome VT100 subset for BusyBox ash, vi and top.
function BenxTerminal(columns, rows, telemetry) {
  const blank = " ".repeat(columns);
  const screen = Array(rows).fill(blank);
  let x = 0, y = 0, savedX = 0, savedY = 0, top = 0, bottom = rows - 1;
  let state = "", sequence = "", wrap = false;
  let changed = true;

  function scrollUp() {
    screen.splice(top, 1);
    screen.splice(bottom, 0, blank);
    changed = true;
  }
  function scrollDown() {
    screen.splice(bottom, 1);
    screen.splice(top, 0, blank);
    changed = true;
  }
  function down() {
    if (y === bottom) scrollUp();
    else y = Math.min(rows - 1, y + 1);
    wrap = false;
  }
  function erase(row, from, to) {
    screen[row] = screen[row].slice(0, from) + " ".repeat(to - from) + screen[row].slice(to);
    changed = true;
  }
  function csi(code, value) {
    if (value[0] === "?") return; // Ignore mode and cursor-visibility switches.
    const params = value.split(";").map(Number);
    const n = params[0] || 1;
    const amount = Math.min(n, rows);
    wrap = false;
    switch (code) {
      case "A": y = Math.max(0, y - n); break;
      case "B": y = Math.min(rows - 1, y + n); break;
      case "C": x = Math.min(columns - 1, x + n); break;
      case "D": x = Math.max(0, x - n); break;
      case "G": x = Math.min(columns - 1, n - 1); break;
      case "d": y = Math.min(rows - 1, n - 1); break;
      case "f":
      case "H":
        y = Math.min(rows - 1, n - 1);
        x = Math.min(columns - 1, (params[1] || 1) - 1);
        break;
      case "J":
        if (params[0] === 2 || params[0] === 3) {
          screen.fill(blank);
          changed = true;
        } else if (params[0] === 1) {
          for (let row = 0; row < y; row++) erase(row, 0, columns);
          erase(y, 0, x + 1);
        } else {
          erase(y, x, columns);
          for (let row = y + 1; row < rows; row++) erase(row, 0, columns);
        }
        break;
      case "K":
        erase(y, params[0] ? 0 : x, params[0] === 1 ? x + 1 : columns);
        break;
      case "X":
        erase(y, x, Math.min(columns, x + n));
        break;
      case "P":
        screen[y] = (screen[y].slice(0, x) + screen[y].slice(x + n)).padEnd(columns, " ");
        changed = true;
        break;
      case "@":
        screen[y] = (screen[y].slice(0, x) + " ".repeat(Math.min(n, columns)) + screen[y].slice(x)).slice(0, columns);
        changed = true;
        break;
      case "L":
      case "M":
        if (y >= top && y <= bottom) {
          for (let line = 0; line < Math.min(amount, bottom - y + 1); line++) {
            screen.splice(code === "L" ? bottom : y, 1);
            screen.splice(code === "L" ? y : bottom, 0, blank);
          }
          changed = true;
        }
        break;
      case "S": for (let i = 0; i < amount; i++) scrollUp(); break;
      case "T": for (let i = 0; i < amount; i++) scrollDown(); break;
      case "r":
        top = Math.min(rows - 1, n - 1);
        bottom = Math.max(top, Math.min(rows - 1, (params[1] || rows) - 1));
        x = y = 0;
        break;
      case "s": savedX = x; savedY = y; break;
      case "u": x = savedX; y = savedY; break;
    }
  }
  function feed(byte) {
    if (state === "osc-escape") {
      if (byte === 92) telemetry(sequence);
      state = "";
      return;
    }
    if (state === "osc") {
      if (byte === 7) {
        telemetry(sequence);
        state = "";
      } else if (byte === 27) {
        state = "osc-escape";
      } else if (sequence.length < 126) {
        sequence += String.fromCharCode(byte);
      }
      return;
    }
    if (state === "csi") {
      if (byte >= 64 && byte <= 126) {
        if (/^[?0-9;]*$/.test(sequence)) csi(String.fromCharCode(byte), sequence);
        state = "";
      } else if (sequence.length < 64) {
        sequence += String.fromCharCode(byte);
      } else {
        state = "";
      }
      return;
    }
    if (state === "charset") {
      state = "";
      return;
    }
    if (state === "escape") {
      sequence = "";
      state = "";
      switch (byte) {
        case 91: state = "csi"; break;
        case 93: state = "osc"; break;
        case 40:
        case 41: state = "charset"; break;
        case 55: savedX = x; savedY = y; break;
        case 56: x = savedX; y = savedY; wrap = false; break;
        case 68: down(); break;
        case 69: x = 0; down(); break;
        case 77:
          if (y === top) scrollDown();
          else y = Math.max(0, y - 1);
          break;
      }
      return;
    }
    switch (byte) {
      case 8: x = Math.max(0, x - 1); wrap = false; return;
      case 9: x = Math.min(columns - 1, (x + 8) & ~7); wrap = false; return;
      case 10:
      case 11:
      case 12: down(); return;
      case 13: x = 0; wrap = false; return;
      case 27: state = "escape"; return;
    }
    if (byte < 32 || byte === 127) return;
    if (wrap) { x = 0; down(); }
    const char = byte < 127 ? String.fromCharCode(byte) : "?";
    screen[y] = screen[y].slice(0, x) + char + screen[y].slice(x + 1);
    if (x === columns - 1) wrap = true;
    else x++;
    changed = true;
  }
  return {
    feed,
    getRows: function () {
      if (!changed) return null;
      changed = false;
      return screen;
    }
  };
}
