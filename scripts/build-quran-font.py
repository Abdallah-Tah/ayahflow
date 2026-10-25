"""Derive the AyahFlow Quran font from Scheherazade New 4.500 (SIL OFL 1.1).
Only change: a ccmp lookup, first in order, draws the sukun U+0652 with the font's own U+06E1 glyph (the open
"jazm" shape the Madinah Mushaf prints, e.g. يَعۡمَلُونَ), so Tanzil's encoding looks like the printed page.
The text is never changed. Renamed because "Scheherazade" is a Reserved Font Name.
Usage (fontTools 4.55.3): python3 scripts/build-quran-font.py content/fonts/ScheherazadeNew-Regular.ttf public/fonts/AyahFlowQuran-Regular.ttf
then copy the output to ios/App/AyahFlowWidget/. Deterministic: the same input gives the same bytes."""
import sys, copy
from fontTools.ttLib import TTFont
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
src, out = sys.argv[1], sys.argv[2]
f = TTFont(src, recalcTimestamp=False)
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
for fr in g.FeatureList.FeatureRecord:
    fr.Feature.LookupListIndex = [i + k for i in fr.Feature.LookupListIndex]
    if fr.FeatureTag == 'ccmp':
        fr.Feature.LookupListIndex.insert(0, 0)
    fr.Feature.LookupCount = len(fr.Feature.LookupListIndex)
assert any(fr.FeatureTag == 'ccmp' for fr in g.FeatureList.FeatureRecord)
# Rename (OFL: a Modified Version may not use the Reserved Font Names "Scheherazade" or "SIL").
name = f['name']
fam, ps = 'AyahFlow Quran', 'AyahFlowQuran-Regular'
desc = ('AyahFlow Quran is a Modified Version of Scheherazade New 4.500 by SIL Global, under the SIL Open Font License 1.1. '
        'Change: the sukun U+0652 is drawn with the U+06E1 (Uthmani jazm) glyph (ccmp).')
for rec in list(name.names):
    if rec.nameID in (16, 17, 18, 21, 22): name.removeNames(nameID=rec.nameID)
for pid, eid, lid in {(r.platformID, r.platEncID, r.langID) for r in name.names}:
    for nid, val in ((1, fam), (2, 'Regular'), (3, '1.000;AyahFlow;' + ps), (4, fam), (6, ps), (10, desc)):
        name.setName(val, nid, pid, eid, lid)
for r in name.names:
    assert 'Scheherazade' not in r.toUnicode() or r.nameID in (0, 5, 7, 10, 13) or r.nameID >= 256, (r.nameID, r.toUnicode())
f.save(out)
print('ok', out)
