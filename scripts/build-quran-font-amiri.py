"""Derive the "AyahFlow Quran Amiri" font, one of the Quran font choices (src/mushaf.ts QURAN_FONTS), from Amiri Quran 1.003 (SIL OFL 1.1, no Reserved Font Names).
Amiri Quran already draws Tanzil's Uthmani encoding the way the printed Madinah Mushaf does: Mushaf letter forms (meem in
أُمَمٍ), final yā' dotless (فِىٓ), the small alif without a stretched joining line, the kasra below a shadda (رَبِّ).
Two changes:
- a ccmp lookup run before any other draws the sukun U+0652 with the font's own U+06E1 glyph, the open "jazm" shape of
  the Madinah print (قَدۡ);
- the word-final meem gets the short tail of the Madinah print and Quran.com (أُمَمٍ), instead of Amiri's long one;
- the pause marks lowered to just over the word end, so they no longer reach into the line above.
The text is never changed. Named AyahFlow Quran Amiri; the default AyahFlow Quran comes from scripts/build-quran-font.py.
Usage (fontTools 4.55.3): python3 scripts/build-quran-font-amiri.py content/fonts/AmiriQuran.ttf public/fonts/AyahFlowQuranAmiri-Regular.ttf
(the reader only; the widgets keep the default font). Deterministic: the same input gives the same bytes."""
import sys
from fontTools.ttLib import TTFont
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
src, out = sys.argv[1], sys.argv[2]
f = TTFont(src, recalcTimestamp=False)
cmap = f.getBestCmap()
assert cmap[0x0652] == 'uni0652' and cmap[0x06E1] == 'uni06E1', 'needs the sukun and the jazm glyph'
MEEM_TAILS = ('glyph00197', 'glyph00199', 'glyph00403')
fea = """languagesystem DFLT dflt;
languagesystem arab dflt;
lookup SUKUN_JAZM { sub uni0652 by uni06E1; } SUKUN_JAZM;
feature ccmp { lookup SUKUN_JAZM; } ccmp;
"""
tmp = TTFont(src)
del tmp['GSUB']
addOpenTypeFeaturesFromString(tmp, fea)
new = tmp['GSUB'].table.LookupList.Lookup  # [SUKUN_JAZM]
assert len(new) == 1
g = f['GSUB'].table
k = len(new)
def shift(lk):
    for st in lk.SubTable:
        t = st.ExtSubTable if lk.LookupType == 7 else st
        for attr in ('SubstLookupRecord', 'ChainSubstLookupRecord'):
            for r in getattr(t, attr, None) or []: r.LookupListIndex += k
        for attr in ('SubRuleSet', 'ChainSubRuleSet'):
            for rs in getattr(t, attr, None) or []:
                for r in (getattr(rs, 'SubRule', None) or getattr(rs, 'ChainSubRule', None) or []):
                    for rec in (getattr(r, 'SubstLookupRecord', None) or getattr(r, 'ChainSubstLookupRecord', None) or []): rec.LookupListIndex += k
        for attr in ('SubClassSet', 'ChainSubClassSet'):
            for cs in getattr(t, attr, None) or []:
                if cs is None: continue
                for r in (getattr(cs, 'SubClassRule', None) or getattr(cs, 'ChainSubClassRule', None) or []):
                    for rec in (getattr(r, 'SubstLookupRecord', None) or getattr(r, 'ChainSubstLookupRecord', None) or []): rec.LookupListIndex += k
for lk in g.LookupList.Lookup: shift(lk)
g.LookupList.Lookup[0:0] = new
g.LookupList.LookupCount = len(g.LookupList.Lookup)
ccmp = 0
for fr in g.FeatureList.FeatureRecord:
    fr.Feature.LookupListIndex = [i + k for i in fr.Feature.LookupListIndex]
    if fr.FeatureTag == 'ccmp':
        fr.Feature.LookupListIndex[0:0] = [0]
        ccmp += 1
    fr.Feature.LookupCount = len(fr.Feature.LookupListIndex)
assert ccmp, 'no ccmp feature to extend'
# The Madinah print and Quran.com end a word-final meem with a short tail; Amiri's drops about half an em. The three
# outlines every word-final meem is built from (final, isolated, and the tail of the يم-style ligatures, found by shaping
# all 6236 ayahs) get a shorter tail: points between TOP and the tip's cap are compressed, the cap moves up unchanged.
TOP, TIP, CAP = -40, -270, 90
WAQF_DY = -620
glyf = f['glyf']
for gname in MEEM_TAILS:
    g = glyf[gname]
    assert not g.isComposite() and g.numberOfContours, gname
    coords = g.coordinates
    low = min(y for _, y in coords)
    assert low < -450, (gname, low)
    b, nb = low + CAP, TIP + CAP
    k = (nb - TOP) / (b - TOP)
    for i, (x, y) in enumerate(coords):
        if y < TOP: coords[i] = (x, round(TOP + (y - TOP) * k) if y >= b else round(y + (nb - b)))
    g.recalcBounds(glyf)
# Amiri draws the pause marks (U+06D6–U+06DC) high, 1316–1814 units, meant for loose line spacing; in the reader they sat
# in the line above. Their outlines are moved down by WAQF_DY so they sit just over the word end. (Positioning lookups did
# the same in CoreText alone but not in WebKit, which shapes the text word by word.)
for cp in range(0x06D6, 0x06DD):
    g = glyf[cmap[cp]]
    assert not g.isComposite() and g.numberOfContours, hex(cp)
    g.coordinates.translate((0, WAQF_DY))
    g.recalcBounds(glyf)
name = f['name']
fam, ps = 'AyahFlow Quran Amiri', 'AyahFlowQuranAmiri-Regular'
desc = ('AyahFlow Quran Amiri is a Modified Version of Amiri Quran 1.003 by the Amiri Project Authors, under the SIL Open Font License 1.1. '
        'Changes: the sukun U+0652 is drawn with the U+06E1 (jazm) glyph; the word-final meem has a shorter tail.')
for rec in list(name.names):
    if rec.nameID in (16, 17, 18, 21, 22): name.removeNames(nameID=rec.nameID)
for pid, eid, lid in {(r.platformID, r.platEncID, r.langID) for r in name.names}:
    for nid, val in ((1, fam), (2, 'Regular'), (3, '1.000;AyahFlow;' + ps), (4, fam), (6, ps), (10, desc)):
        name.setName(val, nid, pid, eid, lid)
f.save(out)
print('ok', out)
