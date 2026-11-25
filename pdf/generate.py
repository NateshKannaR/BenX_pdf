#!/usr/bin/env python3
"""Build the BenX workstation page with native PDF drawing and widget actions."""
# SPDX-License-Identifier: GPL-3.0-or-later
import argparse
import base64
import json
import zlib
from pathlib import Path

from pdfrw import IndirectPdfDict, PdfArray, PdfDict, PdfName, PdfString, PdfWriter

WIDTH, HEIGHT = 956, 737
BG = (0.059, 0.078, 0.098)
PANEL = (0.086, 0.110, 0.137)
TERMINAL = (0.031, 0.046, 0.061)
BORDER = (0.19, 0.24, 0.29)
KEY = (0.125, 0.16, 0.20)
TEXT = (0.90, 0.94, 0.96)
MUTED = (0.57, 0.65, 0.72)
MINT = (0.36, 0.98, 0.72)
CYAN = (0.40, 0.82, 0.96)


def rgb(color):
    return " ".join(map(str, color))


def string(value):
    return PdfString.encode(value)


def font(name):
    return IndirectPdfDict(Type=PdfName.Font, Subtype=PdfName.Type1, BaseFont=PdfName(name),
                           Encoding=PdfName.WinAnsiEncoding)


def action(source):
    return PdfDict(S=PdfName.JavaScript, JS=string(source))


def compressed_stream(content):
    data = zlib.compress(content.encode("ascii"), 9)
    return IndirectPdfDict(Filter=PdfName.FlateDecode, stream=data.decode("latin1"))


def text(x, y, size, value, color=TEXT, face="UI"):
    return f"BT /{face} {size} Tf {rgb(color)} rg 1 0 0 1 {x} {y} Tm {string(value)} Tj ET"


def rect(x, y, width, height, color):
    return f"{rgb(color)} rg {x} {y} {width} {height} re f"


def outline(x, y, width, height, color=BORDER):
    return f"{rgb(color)} RG 0.6 w {x} {y} {width} {height} re S"


class WorkstationPage:
    def __init__(self):
        self.fonts = PdfDict(UI=font("Helvetica"), Bold=font("Helvetica-Bold"),
                             Mono=font("Courier"), MonoBold=font("Courier-Bold"))
        self.resources = PdfDict(Font=self.fonts)
        self.fields = PdfArray()
        self.draw = [rect(0, 0, WIDTH, HEIGHT, BG)]

    def label(self, *args, **kwargs):
        self.draw.append(text(*args, **kwargs))

    def panel(self, x, y, width, height, color=PANEL):
        self.draw.extend((rect(x, y, width, height, color), outline(x, y, width, height)))

    def appearance(self, width, height, commands):
        return IndirectPdfDict(Type=PdfName.XObject, Subtype=PdfName.Form, FormType=1,
                               BBox=PdfArray([0, 0, width, height]), Resources=self.resources,
                               stream="\n".join(commands))

    def field(self, name, x, y, width, height, value="", size=12, fill=PANEL,
              ink=TEXT, editable=False, face="Mono"):
        da = f"/{face} {size} Tf {rgb(ink)} rg"
        commands = [rect(0, 0, width, height, fill)]
        if value:
            commands.append(text(2, (height - size) / 2 + 2, size, value, ink, face))
        field = IndirectPdfDict(
            Type=PdfName.Annot, Subtype=PdfName.Widget, FT=PdfName.Tx, F=4,
            T=string(name), Rect=PdfArray([x, y, x + width, y + height]),
            V=string(value), DV=string(value), DA=string(da), Ff=0 if editable else 1,
            MK=PdfDict(BG=PdfArray(fill)), BS=PdfDict(W=0),
            AP=PdfDict(N=self.appearance(width, height, commands)),
        )
        self.fields.append(field)
        return field

    def button(self, name, label, x, y, width, height, source, primary=False):
        fill, ink = (MINT, TERMINAL) if primary else (KEY, TEXT)
        font_size = 10 if height > 19 else 9
        # Courier Bold glyphs are uniformly 0.6 em wide.
        dx = (width - len(label) * font_size * 0.6) / 2
        ap = self.appearance(width, height, [
            rect(0, 0, width, height, fill),
            outline(0.35, 0.35, width - 0.7, height - 0.7),
            text(dx, (height - font_size) / 2 + 2, font_size, label, ink, "MonoBold"),
        ])
        self.fields.append(IndirectPdfDict(
            Type=PdfName.Annot, Subtype=PdfName.Widget, FT=PdfName.Btn,
            T=string(name), TU=string(label), F=4, Ff=65536, H=PdfName.P,
            Rect=PdfArray([x, y, x + width, y + height]), AP=PdfDict(N=ap),
            MK=PdfDict(CA=string(label), BG=PdfArray(fill)), AA=PdfDict(U=action(source)),
        ))

    def keys(self):
        rows = [
            [("Esc", 50)] + [(f"F{i}", 45) for i in range(1, 13)] + [("Ins", 61), ("Del", 61), ("Home", 61), ("End", 61)],
            [(key, 55) for key in "`1234567890-="] + [("Backspace", 99), ("PgUp", 61)],
            [("Tab", 79)] + [(key, 55) for key in "qwertyuiop[]\\"] + [("PgDn", 61)],
            [("Caps", 94)] + [(key, 55) for key in "asdfghjkl;'"] + [("Enter", 156)],
            [("Shift", 127)] + [(key, 55) for key in "zxcvbnm,./"] + [("Up", 61), ("Shift", 107)],
            [("Ctrl", 80), ("Alt", 79), ("Space", 408), ("Alt", 79), ("Ctrl", 80),
             ("Left", 48), ("Down", 48), ("Right", 48)],
        ]
        for row_index, row in enumerate(rows):
            x = 34
            scale = (888 - 4 * (len(row) - 1)) / sum(width for _, width in row)
            for column_index, (key, width) in enumerate(row):
                width = round(width * scale, 2)
                label = key.upper() if len(key) == 1 else key
                self.button(f"key_{row_index}_{column_index}", label, x, 165 - row_index * 22,
                            width, 17, "benxKey(" + json.dumps(key) + ")")
                x += width + 4

    def build(self, javascript, edition, version, bits, ram):
        self.draw.append(rect(24, 686, 4, 23, MINT))
        self.label(37, 688, 23, "BenX_pdf", face="Bold")
        self.label(174, 694, 11, "The Document That Boots.", MUTED)
        self.label(730, 694, 10, f"{edition.upper()}  /  v{version}  /  RV{bits}", CYAN, "MonoBold")
        self.draw.append(rect(24, 670, 908, 0.8, BORDER))

        self.panel(24, 258, 674, 398, TERMINAL)
        self.draw.append(rect(24, 627, 674, 29, PANEL))
        self.draw.append(rect(37, 639, 5, 5, MINT))
        self.label(51, 638, 10, "LINUX CONSOLE", TEXT, "MonoBold")
        self.label(569, 638, 9, "VIRTIO / HVC0", MUTED, "Mono")
        for row in range(24):
            self.field(f"row_{row}", 36, 609 - row * 14.7, 651, 14.7, size=12.8,
                       fill=TERMINAL, ink=TEXT)

        self.panel(712, 258, 220, 398)
        self.label(728, 634, 11, "SYSTEM", TEXT, "MonoBold")
        self.draw.append(rect(728, 620, 188, 0.6, BORDER))
        self.label(728, 601, 9, "SESSION", MUTED, "Mono")
        self.field("state", 726, 576, 190, 22, "VIEWER CHECK", 16, ink=MINT, face="MonoBold")
        for field, title, y, default in (
            ("rate", "EMULATOR THROUGHPUT", 552, "-"),
            ("memory", "GUEST RAM  /  AVAIL. OF TOTAL", 497, "-"),
            ("uptime", "GUEST UPTIME", 442, "-"),
        ):
            self.label(728, y, 9, title, MUTED, "Mono")
            self.field(field, 726, y - 27, 190, 23, default, 14)
        self.label(728, 386, 9, "VIRTUAL HARDWARE", MUTED, "Mono")
        self.label(728, 367, 11, f"RISC-V {bits}-bit  /  {ram} MiB", TEXT, "Mono")
        self.label(728, 351, 10, "Writable RAM disk", TEXT, "Mono")
        self.draw.append(rect(728, 332, 188, 0.6, BORDER))
        self.button("boot", "Boot", 728, 291, 48, 25, "benxBoot()", True)
        self.button("restart", "Restart", 782, 291, 65, 25, "benxRestart()")
        self.button("reset", "Reset", 853, 291, 63, 25, "benxReset()")
        self.label(728, 272, 8.5, "Restart and reset discard files.", MUTED)

        self.panel(24, 199, 908, 47)
        self.label(36, 226, 9, "COMMAND", MUTED, "MonoBold")
        self.label(130, 228, 8.5, "Enter or Run sends the line to Linux", MUTED)
        field = self.field("command", 128, 209, 726, 16, size=11, fill=TERMINAL, editable=True)
        field.Ff = 4096  # Multiline makes Return a keystroke rather than a viewer commit.
        field.MaxLen = 512
        field.AA = PdfDict(K=action("benxCommandEvent(event)"))
        self.button("run", "Run", 862, 207, 57, 25, 'benxRun(String(benxDoc.getField("command").value))', True)

        self.panel(24, 48, 908, 145)
        self.label(35, 184, 8.5, "VIRTUAL KEYBOARD", MUTED, "MonoBold")
        self.field("mods", 695, 182, 220, 10, "", 8, fill=PANEL, ink=CYAN)
        self.keys()
        self.field("notice", 24, 18, 530, 20, "Use the built-in desktop Chromium PDF viewer.", 10,
                   fill=BG, ink=MINT)
        self.label(644, 24, 9, "OFFLINE  /  SESSION DATA CLEARS ON CLOSE", MUTED, "Mono")

        script = compressed_stream(
            'if (typeof benxInitialized === "undefined") {try {\n' + javascript +
            '\n} catch(e) {app.alert("BenX: " + e);}}'
        )
        page = IndirectPdfDict(
            Type=PdfName.Page, MediaBox=PdfArray([0, 0, WIDTH, HEIGHT]),
            Resources=self.resources, Annots=self.fields,
            Contents=IndirectPdfDict(stream="\n".join(self.draw)),
            AA=PdfDict(O=PdfDict(S=PdfName.JavaScript, JS=script)),
        )
        writer = PdfWriter(version="1.7")
        writer.addpage(page)
        writer.trailer.Root.AcroForm = IndirectPdfDict(
            Fields=self.fields, DR=self.resources, DA=string("/Mono 12 Tf 0 g"),
        )
        writer.trailer.Info = IndirectPdfDict(
            Title=string(f"BenX_pdf {edition}"), Subject=string("The Document That Boots."),
            Author=string("BenX_pdf contributors"),
        )
        return writer


def pack_assets(inputs, bits, ram):
    assets = {"bits": bits, "ram": ram, "sizes": {}}
    for name, path in inputs.items():
        compressed = zlib.compress(path.read_bytes(), 9)
        assets["sizes"][name] = len(compressed)
        assets[name] = [base64.b64encode(compressed[i:i + 49152]).decode("ascii")
                        for i in range(0, len(compressed), 49152)]
    return "var benxAssets = " + json.dumps(assets, separators=(",", ":")) + ";"


def main():
    parser = argparse.ArgumentParser()
    for name in ("bios", "kernel", "root", "pako", "emulator", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--bits", type=int, required=True)
    parser.add_argument("--ram", type=int, required=True)
    parser.add_argument("--edition", required=True)
    parser.add_argument("--version", required=True)
    args = parser.parse_args()
    runtime = Path(__file__).resolve().parents[1] / "runtime"
    inputs = {name: getattr(args, name) for name in ("bios", "kernel", "root")}
    javascript = "\n".join([
        pack_assets(inputs, args.bits, args.ram),
        args.pako.read_text(),
        (runtime / "terminal.js").read_text(),
        (runtime / "workstation.js").read_text(),
        args.emulator.read_text(),
    ])
    writer = WorkstationPage().build(javascript, args.edition, args.version, args.bits, args.ram)
    writer.write(str(args.output))


if __name__ == "__main__":
    main()
