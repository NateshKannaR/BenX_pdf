"""Check that the output is a standalone interactive PDF with an asm.js VM."""
# SPDX-License-Identifier: GPL-3.0-or-later
import json
import sys
import zlib

from pdfrw import PdfName, PdfReader

pdf, edition, bits = sys.argv[1:]
document = PdfReader(pdf)
assert len(document.pages) == 1, "expected a single workstation page"
page = document.pages[0]
fields = {field.T.to_unicode(): field for field in document.Root.AcroForm.Fields}
assert len([name for name in fields if name.startswith("row_")]) == 24
assert len([name for name in fields if name.startswith("key_")]) >= 65
assert fields["command"].FT == PdfName.Tx and int(fields["command"].Ff) == 0
for name in ("boot", "restart", "reset", "run"):
    assert fields[name].AA.U.S == PdfName.JavaScript
assert document.Root.Names is None and document.Root.OpenAction is None
assert page.AA.O.S == PdfName.JavaScript
script = zlib.decompress(page.AA.O.JS.stream.encode("latin1")).decode("ascii")
assets = json.loads(script.split("var benxAssets = ", 1)[1].split(";\n", 1)[0])
assert assets["bits"] == int(bits)
assert all(assets[name] for name in ("bios", "kernel", "root"))
assert '"use asm"' in script and "_benx_start" in script
assert 'new XMLHttpRequest' not in script and "fetch(" not in script
assert document.Info.Title.to_unicode() == f"BenX_pdf {edition}"
print(f"Validated PDF structure and bundled assets for {edition}")
