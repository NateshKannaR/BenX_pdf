// SPDX-License-Identifier: GPL-3.0-or-later
mergeInto(LibraryManager.library, {
  benx_console_write: function (opaque, ptr, length) {
    benxReceive(HEAPU8, ptr, length);
  }
});
