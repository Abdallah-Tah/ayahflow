"""Derive the AyahFlow Quran font from DigitalKhatt Madina v1.0.0 (Amine Anane, sponsored by Tarteel; SIL OFL 1.1), the
Madinah Mushaf calligraphy, with two marks taken from Amiri Quran 1.003 (The Amiri Project Authors, SIL OFL 1.1).
DigitalKhatt draws Tanzil's Uthmani encoding as the Madinah print and Quran.com do (short final meem in أُمَمٍ, the jazm
sukun, the small rounded zero, the small alif, the kasra below a shadda) with no change to its shaping. Changes:
- the default instance of the variable font (its tatweel axes are for a justifying layout engine iOS does not have),
  converted to TrueType outlines (quadratic, max error 1 unit), the format the app and the widget ship;
- the word space widened from 0.1 em to SPACE: without that engine, words would run together;
- U+06EA (imala, 11:41) and U+06EB (ishmam, 12:11), absent from DigitalKhatt, added from Amiri Quran as marks
  over or under the letter before them (iOS would otherwise draw those two ayahs' marks in another font);
- renamed AyahFlow Quran so the reader, the widgets and the Lock Screen keep one font name.
The text is never changed.
Usage (fontTools 4.55.3): python3 scripts/build-quran-font.py content/fonts/DigitalKhattMadina.otf content/fonts/AmiriQuran.ttf public/fonts/AyahFlowQuran-Regular.ttf
then copy the output to ios/App/AyahFlowWidget/. Deterministic: the same inputs give the same bytes."""
import sys
from fontTools.ttLib import TTFont, newTable
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
src, marks_src, out = sys.argv[1:4]
SPACE = 280
WAQF_DX, WAQF_DY = -40, 560
f = TTFont(src, recalcTimestamp=False)
# CFF2 → glyf, outlines at the default location; then the layout tables are instanced there too.
gs, order = f.getGlyphSet(location={a.axisTag: a.defaultValue for a in f['fvar'].axes}), f.getGlyphOrder()
glyf = newTable('glyf'); glyf.glyphOrder = order; glyf.glyphs = {}
for name in order:
    pen = TTGlyphPen(None)
    gs[name].draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
    glyf.glyphs[name] = pen.glyph()
f['glyf'] = glyf
f['loca'] = newTable('loca')
del f['CFF2']
for t in ('DSIG', 'STAT', 'HVAR', 'MVAR'):
    if t in f: del f[t]
f = instantiateVariableFont(f, {a.axisTag: a.defaultValue for a in f['fvar'].axes})
assert 'fvar' not in f and not getattr(f['GDEF'].table, 'VarStore', None)
f.sfntVersion = '\x00\x01\x00\x00'
glyf = f['glyf']
maxp = newTable('maxp'); maxp.tableVersion = 0x00010000
for k in ('maxZones', 'maxTwilightPoints', 'maxStorage', 'maxFunctionDefs', 'maxInstructionDefs', 'maxStackElements', 'maxSizeOfInstructions'): setattr(maxp, k, 1 if k == 'maxZones' else 0)
maxp.numGlyphs = len(order); f['maxp'] = maxp
f['head'].indexToLocFormat = 1; f['head'].glyphDataFormat = 0
f['post'].formatType = 3.0
# Word space.
cmap = f.getBestCmap()
for cp in (0x20, 0xA0):
    if cp in cmap: f['hmtx'][cmap[cp]] = (SPACE, 0)
# Two marks from Amiri Quran, centred over/under the letter they follow (no anchors: a zero-width mark is drawn at the
# end of the base in a right-to-left run, so the outline is moved right by half a typical letter).
a = TTFont(marks_src); acmap, ags = a.getBestCmap(), a.getGlyphSet()
for cp, name, top in ((0x06EA, 'uni06EA', -170), (0x06EB, 'uni06EB', 850)):
    assert cp not in cmap and name not in order, name
    bp = BoundsPen(ags); ags[acmap[cp]].draw(bp)
    xmin, ymin, xmax, ymax = bp.bounds
    dx, dy = 140 - (xmin + xmax) / 2, top - ymax
    rec = DecomposingRecordingPen(ags); ags[acmap[cp]].draw(rec)
    pen = TTGlyphPen(None)
    rec.replay(TransformPen(pen, (1, 0, 0, 1, dx, dy)))
    glyf.glyphs[name] = pen.glyph()
    order.append(name)
    f['hmtx'][name] = (0, 0)
    f['GDEF'].table.GlyphClassDef.classDefs[name] = 3
    for t in f['cmap'].tables:
        if t.isUnicode(): t.cmap[cp] = name
f.setGlyphOrder(order); glyf.glyphOrder = order; f['maxp'].numGlyphs = len(order)
f['hhea'].numberOfHMetrics = len(order)
# Tanzil puts a space before each pause mark (ۖ ۗ ۚ …); DigitalKhatt places them by anchors on letters, so after a space
# they sat on the baseline. One more positioning lookup, run after all others, lifts a pause mark that follows a space
# over the end of the word before it, as the print and Quran.com show it.
WAQF = ' '.join(f'uni{cp:04X}' for cp in range(0x06D6, 0x06DD))
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
probe = TTFont(src)
probe.setGlyphOrder(f.getGlyphOrder())
for t in ('GPOS', 'GSUB'):
    if t in probe: del probe[t]
addOpenTypeFeaturesFromString(probe, f"""languagesystem DFLT dflt;
languagesystem arab dflt;
@WAQF = [{WAQF}];
lookup WAQF_UP {{ pos space @WAQF' <{WAQF_DX} {WAQF_DY} 0 0>; }} WAQF_UP;
feature mark {{ lookup WAQF_UP; }} mark;
""")
up = probe['GPOS'].table.LookupList.Lookup
gp = f['GPOS'].table
base = len(gp.LookupList.Lookup)
for lk in up:  # renumber the contextual lookup's nested references
    for st in lk.SubTable:
        for attr in ('PosLookupRecord', 'ChainPosLookupRecord'):
            for r in getattr(st, attr, None) or []: r.LookupListIndex += base
        for rs in getattr(st, 'ChainPosRuleSet', None) or []:
            for r in rs.ChainPosRule or []:
                for rec in r.ChainPosLookupRecord or []: rec.LookupListIndex += base
gp.LookupList.Lookup.extend(up)
gp.LookupList.LookupCount = len(gp.LookupList.Lookup)
top = [i for i, lk in enumerate(up) if lk.LookupType in (7, 8)]
assert len(top) == 1
added = 0
for fr in gp.FeatureList.FeatureRecord:
    if fr.FeatureTag == 'mark':
        fr.Feature.LookupListIndex.append(base + top[0]); fr.Feature.LookupCount += 1; added += 1
assert added, 'no mark feature'
# Rename: the copyright notices stay; OFL travels with the font.
name = f['name']
fam, ps = 'AyahFlow Quran', 'AyahFlowQuran-Regular'
desc = ('AyahFlow Quran is a Modified Version of DigitalKhatt Madina v1.0.0 (Copyright 2020-2023 Amine Anane) with two marks from Amiri Quran 1.003 (Copyright 2010-2022 The Amiri Project Authors), both under the '
        'SIL Open Font License 1.1. Changes: default instance, TrueType outlines, wider word space, U+06EA and U+06EB added.')
for rec in list(name.names):
    if rec.nameID in (16, 17, 18, 21, 22, 25) or rec.nameID >= 256: name.removeNames(nameID=rec.nameID)
for pid, eid, lid in {(r.platformID, r.platEncID, r.langID) for r in name.names}:
    for nid, val in ((1, fam), (2, 'Regular'), (3, '1.000;AyahFlow;' + ps), (4, fam), (6, ps), (10, desc), (13, 'SIL Open Font License, Version 1.1'), (14, 'https://openfontlicense.org')):
        name.setName(val, nid, pid, eid, lid)
f.save(out)
print('ok', out)
